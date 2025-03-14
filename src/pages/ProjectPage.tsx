import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProjectAvatar from '../components/ProjectAvatar';
import { getAnonymousUserId, getAnonymousUserName } from '../lib/userUtils';
import { sendNewIssueNotification } from '../lib/emailService';
import FounderPresenceIndicator from '../components/FounderPresenceIndicator';
import { debouncedGenerateIssueTitleAndTag, generateIssueTitleAndTag } from '../lib/geminiService';

interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  website?: string;
  logoUrl?: string;
  totalIssues?: number;
  solvedIssues?: number;
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  ownerEmail?: string;
  founderName?: string;
  founderTwitterUrl?: string;
  founderLinkedinUrl?: string;
  founderGithubUrl?: string;
}

interface Thread {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'closed';
  createdAt: Date;
  authorName: string;
  authorId?: string;
  tag: string;
  responseCount?: number;
  anonymousId?: string;
}

// Issue tags
const issueTags = [
  { value: 'bug', label: 'Bug', color: 'text-red-600 bg-red-50' },
  { value: 'feature', label: 'Feature', color: 'text-green-600 bg-green-50' },
  { value: 'question', label: 'Question', color: 'text-blue-600 bg-blue-50' },
  { value: 'help', label: 'Help', color: 'text-purple-600 bg-purple-50' },
  { value: 'documentation', label: 'Docs', color: 'text-yellow-600 bg-yellow-50' }
];

const ProjectPage = () => {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  
  // New thread form state
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [selectedTag, setSelectedTag] = useState(issueTags[0].value);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  
  // AI generation state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  
  // Filtering options
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Sort newest by default without UI control
  const sortOrder = 'newest';

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectSlug) return;

      try {
        // Query the project by slug
        const q = query(
          collection(db, 'projects'),
          where('slug', '==', projectSlug)
        );

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Project not found');
          setLoading(false);
          return;
        }

        // Get the first matching project
        const projectDoc = querySnapshot.docs[0];
        const projectData = projectDoc.data();
        
        // Fetch the owner's email from users collection
        let ownerEmail;
        let founderName;
        let founderTwitterUrl = '';
        let founderLinkedinUrl = '';
        let founderGithubUrl = '';
        
        try {
          const userDoc = await getDoc(doc(db, 'users', projectData.ownerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            ownerEmail = userData.email;
            // Get founder's name from display name or email
            founderName = userData.displayName || userData.email?.split('@')[0] || 'Project Founder';
            // Get founder's social media links if they exist
            founderTwitterUrl = userData.twitterUrl || '';
            founderLinkedinUrl = userData.linkedinUrl || '';
            founderGithubUrl = userData.githubUrl || '';
          }
        } catch (userError) {
          console.error('Error fetching project owner data:', userError);
        }
        
        const projectObj = {
          id: projectDoc.id,
          name: projectData.name,
          description: projectData.description,
          ownerId: projectData.ownerId,
          ownerEmail: ownerEmail,
          createdAt: projectData.createdAt?.toDate() || new Date(),
          totalIssues: projectData.totalIssues || 0,
          solvedIssues: projectData.solvedIssues || 0,
          logoUrl: projectData.logoUrl,
          website: projectData.website,
          twitterUrl: projectData.twitterUrl,
          linkedinUrl: projectData.linkedinUrl,
          githubUrl: projectData.githubUrl,
          founderName: founderName,
          founderTwitterUrl: founderTwitterUrl,
          founderLinkedinUrl: founderLinkedinUrl,
          founderGithubUrl: founderGithubUrl,
        };

        setProject(projectObj);
        
        // Fetch threads for this project
        await fetchThreads(projectDoc.id);
      } catch (error) {
        console.error('Error fetching project:', error);
        setError('Failed to load project');
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectSlug]);

  useEffect(() => {
    // Auto-close the confirmation modal after 5 seconds
    if (showConfirmationModal && !isClosingModal) {
      const timer = setTimeout(() => {
        closeModalWithAnimation();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showConfirmationModal, isClosingModal]);

  useEffect(() => {
    // Check if user has previously closed the banner
    const bannerClosed = localStorage.getItem('helpFromFounderBannerClosed');
    if (bannerClosed) {
      setIsFirstVisit(false);
    }
  }, []);

  // Apply filters and search whenever the threads array or filter options change
  useEffect(() => {
    if (!threads.length) {
      setFilteredThreads([]);
      return;
    }

    let results = [...threads];
    
    // Apply status filter
    if (filterStatus !== 'all') {
      results = results.filter(thread => thread.status === filterStatus);
    }
    
    // Apply tag filter
    if (filterTag !== 'all') {
      results = results.filter(thread => thread.tag === filterTag);
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(thread => 
        thread.title.toLowerCase().includes(query) || 
        thread.content.toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    results = results.sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
    });
    
    setFilteredThreads(results);
  }, [threads, filterStatus, filterTag, searchQuery, sortOrder]);

  const closeModalWithAnimation = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowConfirmationModal(false);
      setIsClosingModal(false);
    }, 300); // Match animation duration
  };

  const fetchThreads = async (projectId: string) => {
    try {
      // Modified query that doesn't use orderBy to avoid requiring the index
      const q = query(
        collection(db, 'threads'),
        where('projectId', '==', projectId)
      );

      const querySnapshot = await getDocs(q);
      const threadsList: Thread[] = [];

      // Simply extract the responseCount from the thread document
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        threadsList.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          authorName: data.authorName,
          authorId: data.authorId,
          tag: data.tag || 'question',
          responseCount: data.responseCount || 0, // Use stored count or default to 0
          anonymousId: data.anonymousId,
        });
      });

      // Sort threads manually client-side
      threadsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setThreads(threadsList);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle content change and generate title and tag
  const handleContentChange = useCallback(async (content: string) => {
    setThreadContent(content);
    
    // Only generate if content has enough characters
    if (content.trim().length >= 10) {
      setIsGeneratingAI(true);
      try {
        const generated = await debouncedGenerateIssueTitleAndTag(content);
        // Only update title if user hasn't manually edited it
        if (generated.title && !hasManuallyEditedTitle) {
          setThreadTitle(generated.title);
        }
        if (generated.tag) {
          setSelectedTag(generated.tag);
        }
      } catch (error) {
        console.error('Error generating title and tag:', error);
      } finally {
        setIsGeneratingAI(false);
      }
    }
  }, []);

  const handleNewThreadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!threadContent.trim()) {
      setFormError('Description is required');
      return;
    }
    
    if (!project) {
      setFormError('Project not found');
      return;
    }
    
    try {
      setSubmitting(true);
      setFormError('');
      
      // If title is still generating or empty, generate one last time
      let finalTitle = threadTitle;
      let finalTag = selectedTag;
      
      if (isGeneratingAI || !finalTitle.trim()) {
        try {
          // Cancel any pending debounced calls
          setIsGeneratingAI(true);
          
          // Generate immediately without debounce for submission
          const generated = await generateIssueTitleAndTag(threadContent);
          finalTitle = generated.title || 'Untitled Issue';
          finalTag = generated.tag || 'question';
          
          // Update state for consistency
          setThreadTitle(finalTitle);
          setSelectedTag(finalTag);
        } catch (error) {
          console.error('Error generating title and tag:', error);
          finalTitle = 'Untitled Issue';
        } finally {
          setIsGeneratingAI(false);
        }
      }
      
      // Use consistent anonymous user identification
      const authorName = currentUser 
        ? (currentUser.displayName || 'Anonymous Founder') 
        : getAnonymousUserName();
      
      const anonymousId = !currentUser ? getAnonymousUserId() : null;
      
      // Create thread document
      const threadRef = await addDoc(collection(db, 'threads'), {
        projectId: project.id,
        title: finalTitle,
        content: threadContent,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorName: authorName,
        authorId: currentUser?.uid || null,
        anonymousId: anonymousId, // Store anonymous ID for non-logged in users
        isPublic: true,
        tag: finalTag,
        responseCount: 0, // Initialize response count to 0
      });
      
      // Increment the totalIssues counter in the project document
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        totalIssues: increment(1)
      });
      
      // Send email notification to the project owner
      const baseUrl = window.location.origin;
      const issueUrl = `${baseUrl}/${projectSlug}/${threadRef.id}`;
      
      // Only send notification if we have the owner's email
      if (project.ownerEmail) {
        sendNewIssueNotification({
          type: 'new_issue',
          projectId: project.id,
          projectName: project.name,
          issueId: threadRef.id,
          issueTitle: finalTitle,
          issueContent: threadContent,
          recipients: [
            {
              email: project.ownerEmail,
              name: 'Project Owner'
            }
          ],
          userName: authorName,
          createdAt: new Date().toISOString(),
          issueUrl: issueUrl
        }).catch(error => {
          // Just log errors here but don't block the UI flow
          console.error('Failed to send email notification:', error);
        });
      } else {
        console.warn('Owner email not available, skipping email notification');
      }
      
      // Reset form
      setThreadTitle('');
      setThreadContent('');
      setSelectedTag(issueTags[0].value);
      setHasManuallyEditedTitle(false);
      setShowNewThreadForm(false);
      
      // Show confirmation modal
      setIsClosingModal(false);
      setShowConfirmationModal(true);
      
      // Fetch updated threads
      await fetchThreads(project.id);
    } catch (error) {
      console.error('Error creating thread:', error);
      setFormError('Failed to create thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get tag badge color based on tag value
  const getTagBadge = (tag: string) => {
    const issueTag = issueTags.find(t => t.value === tag) || issueTags[0];
    return <span className={`px-2 py-1 ${issueTag.color} text-xs rounded-md`}>{issueTag.label}</span>;
  };

  // Format date as relative time (e.g., "2 hours ago")
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
  };

  // Get counts for filter stats
  const getStatusCounts = () => {
    const all = filteredThreads.length;
    const open = filteredThreads.filter(thread => thread.status === 'open').length;
    const closed = filteredThreads.filter(thread => thread.status === 'closed').length;
    
    return { all, open, closed };
  };

  const dismissWelcomeBanner = () => {
    setIsFirstVisit(false);
    localStorage.setItem('helpFromFounderBannerClosed', 'true');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{error || 'Project not found'}</h1>
        <p className="text-gray-600">
          The project you're looking for might have been removed or doesn't exist.
        </p>
      </div>
    );
  }

  const isFounder = currentUser && currentUser.uid === project.ownerId;
  const counts = getStatusCounts();

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Welcome Banner for First-time Visitors */}
      {isFirstVisit && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-5 mb-6 mt-4 relative animate-fadeIn">
          <button 
            onClick={dismissWelcomeBanner} 
            className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 cursor-pointer"
            aria-label="Dismiss welcome banner"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex items-center">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-full mr-4 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-medium text-blue-800 mb-1">
                Direct Line to Founder!
              </h3>
              <p className="text-sm text-blue-700">
                Need help with {project.name}? Ask questions and get personalized answers directly from the founder. No sign-up required.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Header */}
      <div className="mb-8 pt-6">
        <div className="flex items-start space-x-4">
          {project.logoUrl ? (
            <img 
              src={project.logoUrl} 
              alt={`${project.name} logo`} 
              className="w-16 h-16 rounded-md object-cover"
            />
          ) : (
            <ProjectAvatar name={project.name} size="lg" />
          )}
          <div className="flex-1">
            <div className="flex flex-wrap justify-between items-start">
              <h1 className="text-2xl font-medium text-gray-900 mb-2">{project.name}</h1>
              {isFounder && (
                <div className="mt-1 md:mt-0">
                  <div className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md">
                    You are the founder of this project
                  </div>
                </div>
              )}
            </div>
            <p className="text-gray-600 mb-3 max-w-2xl">{project.description}</p>
            
            <div className="flex flex-wrap items-center gap-4">
              {project.website && (
                <a 
                  href={project.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {project.website.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}
              
              {/* Social links combined into a simpler format */}
              <div className="flex items-center gap-3">
                {project.twitterUrl && (
                  <a 
                    href={project.twitterUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Twitter/X profile"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                
                {project.linkedinUrl && (
                  <a 
                    href={project.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="LinkedIn profile"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
                    </svg>
                  </a>
                )}
                
                {project.githubUrl && (
                  <a 
                    href={project.githubUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="GitHub profile"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.236 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                  </a>
                )}
              </div>
              
              <div className="flex items-center text-sm text-gray-500">
                <span className="inline-flex items-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {counts.all} issues total
                </span>
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {counts.closed} closed ({Math.round((counts.closed / Math.max(counts.all, 1)) * 100)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Integrated Founder Information - Apple Style */}
      {project.founderName && (
        <div className="flex items-center mt-4">
          <div className="flex-shrink-0 mr-3">
            <div className="w-6 h-6 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
              {project.founderName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex flex-col">
              <div className="flex items-center">
                <div className="flex items-center">
                  <p className="text-sm text-gray-600">
                    <span className="text-gray-900 font-medium">{project.founderName}</span>
                    <span className="mx-1.5 text-gray-400">·</span>
                    <span>Founder</span>
                  </p>
                </div>
                <FounderPresenceIndicator userId={project.ownerId} />
                <div className="ml-auto flex items-center space-x-3">
                  {project.founderTwitterUrl && (
                    <a 
                      href={project.founderTwitterUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 transition-colors flex items-center"
                      aria-label="Founder's Twitter/X profile"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="text-xs">Twitter</span>
                    </a>
                  )}
                  
                  {project.founderLinkedinUrl && (
                    <a 
                      href={project.founderLinkedinUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 transition-colors flex items-center"
                      aria-label="Founder's LinkedIn profile"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span className="text-xs">LinkedIn</span>
                    </a>
                  )}
                  
                  {project.founderGithubUrl && (
                    <a 
                      href={project.founderGithubUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 transition-colors flex items-center"
                      aria-label="Founder's GitHub profile"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.236 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                      </svg>
                      <span className="text-xs">GitHub</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 my-4"></div> {/* Top separator */}

      {/* Primary CTA - Prominent and focused when form is closed, subtle when form is open */}
      <div className="mt-8">
        <button
          onClick={() => {
            if (showNewThreadForm) {
              // Reset form when closing
              setShowNewThreadForm(false);
              setIsEditingTitle(false);
            } else {
              setShowNewThreadForm(true);
            }
          }}
          className={`w-full px-5 py-4 ${
            showNewThreadForm 
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } rounded-md transition-colors flex items-center justify-center text-base font-medium shadow-sm`}
          aria-label="Get help from founder"
        >
          <svg className={`h-5 w-5 mr-2 ${showNewThreadForm ? 'text-gray-500' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {showNewThreadForm ? 'Close Form' : `Ask ${project.founderName ? project.founderName.split(' ')[0] : 'the Founder'} for Help`}
        </button>
        {!showNewThreadForm && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Get a personal response directly from {project.founderName || 'the creator of ' + project.name}
          </p>
        )}
      </div>

      {/* New Thread Form - Minimalist Apple-style design */}
      {showNewThreadForm && (
        <div className="border border-gray-200 rounded-md p-6 mb-8 shadow-sm mt-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Ask a question</h3>
            <button 
              onClick={() => {
                setShowNewThreadForm(false);
                setIsEditingTitle(false);
              }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label="Close form"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-md mb-4 text-sm">
              {formError}
            </div>
          )}
          
          <form onSubmit={handleNewThreadSubmit} className="space-y-5">
            <div>
              <label htmlFor="issue-content" className="block text-sm font-medium text-gray-700 mb-1">
                Describe your question or issue
              </label>
              <textarea
                id="issue-content"
                value={threadContent}
                onChange={(e) => handleContentChange(e.target.value)}
                required
                rows={6}
                placeholder="What would you like help with?"
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Smart preview section */}
            {threadContent.trim().length >= 10 && (
              <div className="border-t border-gray-100 pt-4">
                <div className="text-sm text-gray-500 mb-2">Preview</div>
                
                <div className="space-y-3">
                  {/* Title preview */}
                  <div>
                    <div className="w-full flex items-center gap-2">
                      {isEditingTitle ? (
                        <div className="w-full flex items-center gap-2">
                          <input
                            type="text"
                            value={threadTitle}
                            onChange={(e) => {
                              setThreadTitle(e.target.value);
                              setHasManuallyEditedTitle(true);
                            }}
                            className="font-medium text-gray-900 border-b border-gray-300 focus:border-blue-500 focus:outline-none py-1 w-full"
                            placeholder="Enter a title"
                            autoFocus
                            onBlur={() => setIsEditingTitle(false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setIsEditingTitle(false);
                              }
                            }}
                          />
                          <button
                            onClick={() => setIsEditingTitle(false)}
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                            title="Save title"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="font-medium text-gray-900">{threadTitle || (isGeneratingAI ? 'Generating title...' : 'Title')}</h4>
                          {!isGeneratingAI && threadTitle && (
                            <button
                              onClick={() => setIsEditingTitle(true)}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                              aria-label="Edit title"
                              title="Edit title"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                          )}
                          {hasManuallyEditedTitle && threadTitle && (
                            <span className="text-xs text-blue-500 ml-2" title="You've edited this title">
                              (edited)
                            </span>
                          )}
                        </>
                      )}
                      {isGeneratingAI && (
                        <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tag preview */}
                  <div>
                    {isGeneratingAI ? (
                      <div className="animate-pulse h-5 w-16 bg-gray-200 rounded-md"></div>
                    ) : (
                      getTagBadge(selectedTag)
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || isGeneratingAI || (threadContent.trim().length < 10)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                {submitting ? 'Sending...' : (isGeneratingAI ? 'Generating Title...' : 'Send to Founder')}
              </button>
              
              <p className="mt-3 text-xs text-center text-gray-500">
                {threadContent.trim().length < 10 ? 
                  'Start typing to generate a title and topic automatically' : 
                  'Title and topic will be generated automatically based on your description'}
              </p>
              
              {currentUser && (
                <div className="flex items-center justify-center text-sm text-gray-500 mt-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>You'll receive a response by email</p>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Issues List */}
      {threads.length > 0 ? (
        <>
          {filteredThreads.length > 0 ? (
            <div>
              <h2 className="text-lg font-medium text-gray-800 mb-3">Previous Questions</h2>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
                {filteredThreads.map((thread) => (
                  <Link 
                    key={thread.id} 
                    to={`/${projectSlug}/thread/${thread.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start">
                      <div className="mr-3 mt-1">
                        {thread.status === 'open' && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-blue-600 bg-blue-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {thread.status === 'closed' && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-green-600 bg-green-100 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-medium text-gray-900 truncate">{thread.title}</h3>
                          {getTagBadge(thread.tag)}
                        </div>
                        
                        <div className="flex flex-wrap items-center text-xs text-gray-500">
                          <span>Asked {formatRelativeTime(thread.createdAt)}</span>
                          {((!currentUser && thread.anonymousId === getAnonymousUserId()) || 
                            (currentUser && currentUser.uid === thread.authorId)) && (
                            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">You</span>
                          )}
                          {(thread.responseCount || 0) > 0 && (
                            <span className="ml-4 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                              </svg>
                              {thread.responseCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-base font-medium text-gray-900 mb-1">No results found</h3>
              <p className="text-gray-600 text-sm mb-2">
                Looks like there are no matching questions.
              </p>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterTag('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm mt-1"
              >
                Reset
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="border border-gray-200 rounded-md p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute -right-1 -top-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Be the first to ask a question</h3>
          <p className="text-gray-600 text-sm mb-4 max-w-md mx-auto">
            Get a personal response from {project.founderName ? project.founderName : `the creator of ${project.name}`}.
          </p>
          <button
            onClick={() => setShowNewThreadForm(true)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center text-sm font-medium shadow-sm"
          >
            <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Ask a Question
          </button>
          <p className="text-gray-500 text-xs mt-3">
            No account needed to ask — create an account to receive email notifications
          </p>
        </div>
      )}

      {/* Confirmation Modal - Simplified */}
      {showConfirmationModal && (
        <div className={`fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4 ${isClosingModal ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
          <div className={`bg-white rounded-lg max-w-md w-full p-6 shadow-lg ${isClosingModal ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
            <div className="text-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900">Question Sent!</h3>
            </div>
            
            <p className="text-gray-600 mb-6 text-center">
              {project.founderName ? `${project.founderName} will respond to your question soon.` : `The founder of ${project.name} will respond to your question soon.`}
            </p>
            
            {!currentUser && (
              <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-5">
                <h4 className="text-blue-800 font-medium mb-1 text-sm">Want to get notified?</h4>
                <p className="text-blue-700 text-sm mb-3">
                  Create an account to receive email notifications when the founder responds to your question.
                </p>
                <Link 
                  to={`/register?redirect=${encodeURIComponent(`/${projectSlug}`)}`}
                  className="inline-flex items-center text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  onClick={closeModalWithAnimation}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Create Account
                </Link>
              </div>
            )}
            
            <div className="text-center">
              <button
                onClick={closeModalWithAnimation}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-base font-medium cursor-pointer shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPage; 