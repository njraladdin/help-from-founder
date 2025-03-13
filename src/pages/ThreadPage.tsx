import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment, deleteDoc, FieldValue } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { getAnonymousUserId, getAnonymousUserName } from '../lib/userUtils';
import { sendNewIssueNotification } from '../lib/emailService';

interface Thread {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'resolved' | 'closed';
  createdAt: Date;
  authorName: string;
  projectId: string;
  tag: string;
  anonymousId?: string;
}

interface Response {
  id: string;
  content: string;
  createdAt: Date;
  authorName: string;
  authorId?: string;
  anonymousId?: string;
  isFounder: boolean;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  ownerEmail?: string;
}

// Issue tags
const issueTags = [
  { value: 'bug', label: 'Bug', color: 'text-red-600 bg-red-50' },
  { value: 'feature', label: 'Feature', color: 'text-green-600 bg-green-50' },
  { value: 'question', label: 'Question', color: 'text-blue-600 bg-blue-50' },
  { value: 'help', label: 'Help', color: 'text-purple-600 bg-purple-50' },
  { value: 'documentation', label: 'Docs', color: 'text-yellow-600 bg-yellow-50' }
];

const ThreadPage = () => {
  const { projectSlug, threadId } = useParams<{ projectSlug: string; threadId: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Response form state
  const [responseContent, setResponseContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Add delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchThreadAndProject = async () => {
      if (!projectSlug || !threadId) {
        setError('Thread not found');
        setLoading(false);
        return;
      }

      try {
        // Find project by slug
        const projectQuery = query(
          collection(db, 'projects'),
          where('slug', '==', projectSlug)
        );
        
        const projectSnapshot = await getDocs(projectQuery);
        
        if (projectSnapshot.empty) {
          setError('Project not found');
          setLoading(false);
          return;
        }
        
        const projectDoc = projectSnapshot.docs[0];
        const projectData = projectDoc.data();
        
        // Fetch the owner's email from users collection
        let ownerEmail;
        try {
          const userDoc = await getDoc(doc(db, 'users', projectData.ownerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            ownerEmail = userData.email;
          }
        } catch (userError) {
          console.error('Error fetching project owner data:', userError);
        }
        
        const projectObj = {
          id: projectDoc.id,
          name: projectData.name,
          slug: projectData.slug,
          ownerId: projectData.ownerId,
          ownerEmail: ownerEmail,
          twitterUrl: projectData.twitterUrl,
          linkedinUrl: projectData.linkedinUrl,
          githubUrl: projectData.githubUrl,
        };
        
        setProject(projectObj);
        
        // Find thread by ID
        const threadDocRef = doc(db, 'threads', threadId);
        const threadSnapshot = await getDoc(threadDocRef);
        
        if (!threadSnapshot.exists()) {
          setError('Thread not found');
          setLoading(false);
          return;
        }
        
        const threadData = threadSnapshot.data();
        
        // Ensure thread belongs to the correct project
        if (threadData.projectId !== projectDoc.id) {
          setError('Thread not found in this project');
          setLoading(false);
          return;
        }
        
        const threadObj = {
          id: threadSnapshot.id,
          title: threadData.title,
          content: threadData.content,
          status: threadData.status,
          createdAt: threadData.createdAt?.toDate() || new Date(),
          authorName: threadData.authorName,
          projectId: threadData.projectId,
          tag: threadData.tag || 'question',
          anonymousId: threadData.anonymousId,
        };
        
        setThread(threadObj);
        
        // Fetch responses
        await fetchResponses(threadId);
        
      } catch (error) {
        console.error('Error fetching thread:', error);
        setError('Failed to load thread');
      } finally {
        setLoading(false);
      }
    };

    fetchThreadAndProject();
  }, [projectSlug, threadId]);

  const fetchResponses = async (threadId: string) => {
    try {
      const q = query(
        collection(db, 'responses'),
        where('threadId', '==', threadId)
      );

      const querySnapshot = await getDocs(q);
      const responsesList: Response[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        responsesList.push({
          id: doc.id,
          content: data.content,
          createdAt: data.createdAt?.toDate() || new Date(),
          authorName: data.authorName,
          authorId: data.authorId,
          anonymousId: data.anonymousId,
          isFounder: data.isFounder || false,
        });
      });

      // Sort responses manually by date ascending (oldest first)
      responsesList.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      setResponses(responsesList);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const handleSubmitResponse = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!responseContent.trim()) {
      setFormError('Response content is required');
      return;
    }
    
    if (!thread || !project) {
      setFormError('Thread or project not found');
      return;
    }
    
    try {
      setSubmitting(true);
      setFormError('');
      
      const isFounder = currentUser && currentUser.uid === project.ownerId;
      
      // Use consistent anonymous user identification
      const authorName = currentUser 
        ? (currentUser.displayName || 'Anonymous Founder') 
        : getAnonymousUserName();
      
      const anonymousId = !currentUser ? getAnonymousUserId() : null;
      
      // Create response document
      await addDoc(collection(db, 'responses'), {
        threadId: thread.id,
        content: responseContent,
        createdAt: serverTimestamp(),
        authorName: authorName,
        authorId: currentUser?.uid || null,
        anonymousId: anonymousId, // Store anonymous ID for non-logged in users
        isFounder,
      });
      
      // Increment response count in thread document
      const threadRef = doc(db, 'threads', thread.id);
      await updateDoc(threadRef, {
        responseCount: increment(1)
      });
      
      // Send email notification to the project owner if the response is not from the founder
      if (!isFounder && project.ownerEmail) {
        // Create the issue URL
        const baseUrl = window.location.origin;
        const issueUrl = `${baseUrl}/${projectSlug}/thread/${threadId}`;
        
        // Send notification
        sendNewIssueNotification({
          type: 'new_response',
          projectId: project.id,
          projectName: project.name,
          issueId: thread.id,
          issueTitle: thread.title,
          responseContent: responseContent,
          responseAuthor: authorName,
          founderEmail: project.ownerEmail,
          createdAt: new Date().toISOString(),
          issueUrl: issueUrl
        }).catch(error => {
          // Just log errors here but don't block the UI flow
          console.error('Failed to send email notification:', error);
        });
      }
      
      // Reset form
      setResponseContent('');
      
      // Fetch updated responses
      await fetchResponses(thread.id);
    } catch (error) {
      console.error('Error creating response:', error);
      setFormError('Failed to add response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'open' | 'resolved' | 'closed') => {
    if (!thread || !project || !currentUser) return;
    
    // Only the founder can update the status
    if (currentUser.uid !== project.ownerId) return;
    
    try {
      const threadRef = doc(db, 'threads', thread.id);
      await updateDoc(threadRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      // Update the solvedIssues counter based on status change
      const projectRef = doc(db, 'projects', thread.projectId);
      
      // If changing to 'resolved' from a different status, increment solvedIssues
      if (newStatus === 'resolved' && thread.status !== 'resolved') {
        await updateDoc(projectRef, {
          solvedIssues: increment(1)
        });
      } 
      // If changing from 'resolved' to a different status, decrement solvedIssues
      else if (thread.status === 'resolved' && newStatus !== 'resolved') {
        await updateDoc(projectRef, {
          solvedIssues: increment(-1)
        });
      }
      
      // Update local thread state
      setThread({
        ...thread,
        status: newStatus,
      });
    } catch (error) {
      console.error('Error updating thread status:', error);
    }
  };

  const handleDeleteThread = async () => {
    if (!thread || !project || !currentUser) return;
    
    // Only the founder can delete the thread
    if (currentUser.uid !== project.ownerId) return;
    
    try {
      setIsDeleting(true);
      
      // Get all responses to this thread
      const responsesQuery = query(
        collection(db, 'responses'),
        where('threadId', '==', thread.id)
      );
      
      const responsesSnapshot = await getDocs(responsesQuery);
      
      // Delete all responses
      const deleteResponsePromises = responsesSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deleteResponsePromises);
      
      // Delete the thread document
      await deleteDoc(doc(db, 'threads', thread.id));
      
      // Update the project counters
      const projectRef = doc(db, 'projects', thread.projectId);
      
      // Decrement totalIssues
      const updateData: { totalIssues: FieldValue; solvedIssues?: FieldValue } = {
        totalIssues: increment(-1)
      };
      
      // If thread was resolved, also decrement solvedIssues
      if (thread.status === 'resolved') {
        updateData.solvedIssues = increment(-1);
      }
      
      await updateDoc(projectRef, updateData);
      
      // Redirect back to project page
      navigate(`/${projectSlug}`);
    } catch (error) {
      console.error('Error deleting thread:', error);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
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

  // Get tag badge
  const getTagBadge = (tag: string) => {
    const issueTag = issueTags.find(t => t.value === tag) || issueTags[0];
    return <span className={`px-2 py-1 ${issueTag.color} text-xs rounded-md`}>{issueTag.label}</span>;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md">Open</span>;
      case 'resolved':
        return <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-md">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">Closed</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !thread || !project) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 px-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{error || 'Thread not found'}</h1>
        <p className="text-gray-600 mb-6">
          The thread you're looking for might have been removed or doesn't exist.
        </p>
        {projectSlug && (
          <Link
            to={`/${projectSlug}`}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Project
          </Link>
        )}
      </div>
    );
  }

  const isFounder = currentUser && currentUser.uid === project.ownerId;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">
      {/* Breadcrumb Navigation */}
      <div className="py-4 text-sm flex items-center mb-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">Home</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mx-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/${projectSlug}`} className="text-gray-500 hover:text-gray-700 transition-colors font-medium">{project.name}</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mx-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 truncate max-w-[180px]">{thread.title}</span>
      </div>
      
      {/* Thread Header */}
      <div className="border border-gray-200 rounded-lg p-6 mb-8 shadow-sm bg-white">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2">
            {getStatusBadge(thread.status)}
            {getTagBadge(thread.tag)}
          </div>
          
          {/* Status Controls - Only visible to founders */}
          {isFounder && thread.status !== 'closed' && (
            <div className="dropdown relative">
              <button className="text-gray-500 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10 hidden">
                {thread.status === 'open' && (
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Mark as Resolved
                  </button>
                )}
                {thread.status === 'resolved' && (
                  <button
                    onClick={() => handleUpdateStatus('open')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Reopen Issue
                  </button>
                )}
                <button
                  onClick={() => handleUpdateStatus('closed')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Close Issue
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
        
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{thread.title}</h1>
        
        <div className="flex items-center mb-6">
          <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="ml-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{thread.authorName}</span>
            <span className="mx-2">·</span>
            <span>{formatRelativeTime(thread.createdAt)}</span>
            {!currentUser && thread.anonymousId === getAnonymousUserId() && (
              <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">You</span>
            )}
          </div>
        </div>
        
        <div className="prose max-w-none mb-6 p-4 bg-gray-50 rounded-lg whitespace-pre-line border border-gray-100">
          {thread.content}
        </div>
      </div>
      
      {/* Conversation Section */}
      <div className="mb-8">
        {responses.length > 0 ? (
          <div className="space-y-4">
            {responses.map((response) => (
              <div 
                key={response.id} 
                className={`border border-gray-200 rounded-lg overflow-hidden ${response.isFounder ? 'border-l-4 border-l-blue-500' : ''}`}
              >
                <div className={`flex items-center justify-between px-4 py-3 ${response.isFounder ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${response.isFounder ? 'bg-blue-100' : 'bg-gray-200'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${response.isFounder ? 'text-blue-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{response.authorName}</span>
                      {response.isFounder && (
                        <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          Founder
                        </span>
                      )}
                      {!currentUser && response.anonymousId === getAnonymousUserId() && (
                        <span className="ml-2 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatRelativeTime(response.createdAt)}
                  </div>
                </div>
                
                <div className="px-4 py-4 bg-white">
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line">
                    {response.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-800 mb-2">No responses yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Be the first to respond to this question. Your insights could help solve this issue.
            </p>
          </div>
        )}
      </div>
      
      {/* Add Response Form - Only visible if thread is not closed */}
      {thread.status !== 'closed' ? (
        <div className="border border-gray-200 rounded-lg p-6 mb-8 shadow-sm bg-white">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {isFounder ? "Reply to this question" : "Add your response"}
          </h3>
          
          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-md mb-4 text-sm">
              {formError}
            </div>
          )}
          
          <form onSubmit={handleSubmitResponse} className="space-y-4">
            <div>
              <textarea
                value={responseContent}
                onChange={(e) => setResponseContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder={isFounder ? "Type your response to help solve this issue..." : "Share your thoughts or additional information..."}
                required
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                {!currentUser && (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Your name will appear as "{getAnonymousUserName()}"
                  </>
                )}
              </p>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2.5 ${isFounder ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900'} text-white rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full md:w-auto`}
              >
                {submitting ? 'Sending...' : isFounder ? 'Send Founder Response' : 'Post Response'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-6 text-center mb-8 bg-gray-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="font-medium text-gray-900 mb-2">This conversation is closed</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            The founder has closed this thread and it is no longer accepting new responses.
          </p>
        </div>
      )}
      
      {/* Back to Project Link */}
      <div className="text-center">
        <Link
          to={`/${projectSlug}`}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {project.name}
        </Link>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full mx-auto p-6 shadow-xl animate-scale-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="text-xl font-medium text-gray-900 mb-2 text-center">Delete this thread?</h3>
            <p className="text-gray-600 mb-6 text-center">
              This will permanently delete this thread and all responses. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-70"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Thread'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadPage; 