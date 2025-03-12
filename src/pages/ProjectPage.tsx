import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProjectAvatar from '../components/ProjectAvatar';
import { getAnonymousUserId, getAnonymousUserName } from '../lib/userUtils';

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
}

interface Thread {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'resolved';
  createdAt: Date;
  authorName: string;
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
  
  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [submittedThreadTitle, setSubmittedThreadTitle] = useState('');
  const [isClosingModal, setIsClosingModal] = useState(false);
  
  // Filtering options
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
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
        
        const projectObj = {
          id: projectDoc.id,
          name: projectData.name,
          description: projectData.description,
          ownerId: projectData.ownerId,
          website: projectData.website,
          logoUrl: projectData.logoUrl,
          totalIssues: projectData.totalIssues || 0,
          solvedIssues: projectData.solvedIssues || 0,
          createdAt: projectData.createdAt?.toDate() || new Date(),
          twitterUrl: projectData.twitterUrl,
          linkedinUrl: projectData.linkedinUrl,
          githubUrl: projectData.githubUrl,
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

  const handleNewThreadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!threadTitle.trim()) {
      setFormError('Title is required');
      return;
    }
    
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
      
      // Use consistent anonymous user identification
      const authorName = currentUser 
        ? (currentUser.displayName || 'Anonymous Founder') 
        : getAnonymousUserName();
      
      const anonymousId = !currentUser ? getAnonymousUserId() : null;
      
      // Create thread document
      await addDoc(collection(db, 'threads'), {
        projectId: project.id,
        title: threadTitle,
        content: threadContent,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorName: authorName,
        authorId: currentUser?.uid || null,
        anonymousId: anonymousId, // Store anonymous ID for non-logged in users
        isPublic: true,
        tag: selectedTag,
        responseCount: 0, // Initialize response count to 0
      });
      
      // Increment the totalIssues counter in the project document
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        totalIssues: increment(1)
      });
      
      // Store the title for the confirmation message
      setSubmittedThreadTitle(threadTitle);
      
      // Reset form
      setThreadTitle('');
      setThreadContent('');
      setSelectedTag(issueTags[0].value);
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
    const resolved = filteredThreads.filter(thread => thread.status === 'resolved').length;
    
    return { all, open, resolved };
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
        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 mt-4 relative animate-fadeIn">
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
              <h3 className="text-base font-medium text-blue-800 mb-1">Get direct help from the founder!</h3>
              <p className="text-sm text-blue-700">
                Ask questions or report issues and get answers directly from the founder of {project.name}. No account needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Header */}
      <div className="mb-6 pt-6">
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
              
              {/* Twitter/X Link */}
              {project.twitterUrl && (
                <a 
                  href={project.twitterUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
                  aria-label="Twitter/X profile"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X
                </a>
              )}
              
              {/* LinkedIn Link */}
              {project.linkedinUrl && (
                <a 
                  href={project.linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
                  aria-label="LinkedIn profile"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
                  </svg>
                  LinkedIn
                </a>
              )}
              
              {/* GitHub Link */}
              {project.githubUrl && (
                <a 
                  href={project.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
                  aria-label="GitHub profile"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
              )}
              
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
                  {counts.resolved} resolved ({Math.round((counts.resolved / Math.max(counts.all, 1)) * 100)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar - Simplified */}
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <div className="w-full md:w-auto flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text" 
              placeholder="Search questions and issues"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full py-2 px-4 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
              aria-label="Search issues"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <select 
            value={filterTag} 
            onChange={(e) => setFilterTag(e.target.value)}
            className="py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm bg-white cursor-pointer"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {issueTags.map(tag => (
              <option key={tag.value} value={tag.value}>{tag.label}</option>
            ))}
          </select>
          
          <button
            onClick={() => setShowNewThreadForm(!showNewThreadForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center text-sm whitespace-nowrap cursor-pointer"
            aria-label="Create new issue"
          >
            <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            I have an Issue
          </button>
        </div>
      </div>

      {/* New Thread Form - Simplified */}
      {showNewThreadForm && (
        <div className="border border-gray-200 rounded-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-medium text-gray-900">Ask a question or report an issue</h3>
            <button 
              onClick={() => setShowNewThreadForm(false)}
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
          
          <form onSubmit={handleNewThreadSubmit} className="space-y-4">
            <div>
              <label htmlFor="issue-title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                id="issue-title"
                type="text"
                value={threadTitle}
                onChange={(e) => setThreadTitle(e.target.value)}
                required
                placeholder="Brief summary of your question or issue"
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="issue-content" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="issue-content"
                value={threadContent}
                onChange={(e) => setThreadContent(e.target.value)}
                required
                rows={5}
                placeholder="Describe your question or issue in detail"
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="issue-tag" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="issue-tag"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select a category</option>
                {issueTags.map(tag => (
                  <option key={tag.value} value={tag.value}>{tag.label}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <p className="text-center text-sm text-gray-500 mt-3">
                The founder will be notified immediately and will respond to you as soon as they're available.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Issues List */}
      {threads.length > 0 ? (
        <>
          {filteredThreads.length > 0 ? (
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
                      {thread.status === 'resolved' && (
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
                        <span className="truncate">#{thread.id.substring(0, 6)} opened {formatRelativeTime(thread.createdAt)} by {thread.authorName}</span>
                        {!currentUser && thread.anonymousId === getAnonymousUserId() && (
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
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-base font-medium text-gray-900 mb-2">No matching issues found</h3>
              <p className="text-gray-600 text-sm mb-4">
                Try adjusting your search or filter to find what you're looking for.
              </p>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterTag('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="border border-gray-200 rounded-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -right-1 -top-1 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Get direct help from the founder</h3>
          <p className="text-gray-600 text-sm mb-3 max-w-md mx-auto">
            Be the first to report an issue or ask a question. The founder will personally respond to your message.
          </p>
          <button
            onClick={() => setShowNewThreadForm(true)}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors inline-flex items-center text-sm font-medium"
          >
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Issue
          </button>
          <p className="text-gray-500 text-xs mt-4">
            No account required — all issues are public
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className={`fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 px-4 ${isClosingModal ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
          <div className={`bg-white rounded-lg max-w-md w-full p-6 shadow-lg ${isClosingModal ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
            <div className="text-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900">Issue Submitted</h3>
            </div>
            
            <p className="text-gray-600 mb-6 text-center">
              We've notified the founder about your issue "<span className="font-medium">{submittedThreadTitle}</span>". 
              You'll receive a response as soon as they're available.
            </p>
            
            <div className="text-center">
              <button
                onClick={closeModalWithAnimation}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm cursor-pointer"
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