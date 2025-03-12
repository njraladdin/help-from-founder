import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment, deleteDoc, FieldValue } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProjectAvatar from '../components/ProjectAvatar';
import { getAnonymousUserId, getAnonymousUserName } from '../lib/userUtils';

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
        
        const projectObj = {
          id: projectDoc.id,
          name: projectData.name,
          slug: projectData.slug,
          ownerId: projectData.ownerId,
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
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (error || !thread || !project) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{error || 'Thread not found'}</h1>
        <p className="text-gray-600 mb-6">
          The thread you're looking for might have been removed or doesn't exist.
        </p>
        {projectSlug && (
          <Link
            to={`/${projectSlug}`}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Back to Project
          </Link>
        )}
      </div>
    );
  }

  const isFounder = currentUser && currentUser.uid === project.ownerId;

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Breadcrumb Navigation */}
      <div className="mb-6 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-700">Home</Link>
        <span className="mx-2">/</span>
        <Link to={`/${projectSlug}`} className="hover:text-gray-700">{project.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Issue</span>
      </div>
      
      {/* Thread Header */}
      <div className="border border-gray-200 rounded-md p-6 mb-8">
        <div className="flex items-center space-x-2 mb-4">
          {getStatusBadge(thread.status)}
          {getTagBadge(thread.tag)}
        </div>
        
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{thread.title}</h1>
        
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <span>Opened {formatRelativeTime(thread.createdAt)} by {thread.authorName}</span>
          {!currentUser && thread.anonymousId === getAnonymousUserId() && (
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">You</span>
          )}
        </div>
        
        <div className="prose max-w-none mb-6 p-4 bg-gray-50 rounded-md whitespace-pre-line border border-gray-100">
          {thread.content}
        </div>
        
        {/* Thread Status Controls - Only visible to founders */}
        {isFounder && thread.status !== 'closed' && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Manage this issue:</p>
            <div className="flex space-x-2">
              {thread.status === 'open' && (
                <button
                  onClick={() => handleUpdateStatus('resolved')}
                  className="px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors text-sm"
                >
                  Mark as Resolved
                </button>
              )}
              {thread.status === 'resolved' && (
                <button
                  onClick={() => handleUpdateStatus('open')}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm"
                >
                  Reopen Issue
                </button>
              )}
              <button
                onClick={() => handleUpdateStatus('closed')}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Close Issue
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm ml-auto"
              >
                Delete
              </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-md max-w-md w-full mx-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Delete this issue?</h3>
                  <p className="text-gray-600 mb-4">
                    This will permanently delete this issue and all its responses. This action cannot be undone.
                  </p>
                  <div className="flex space-x-3 justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteThread}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Responses Section */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-900 mb-6">{responses.length} {responses.length === 1 ? 'Response' : 'Responses'}</h2>
        
        {responses.length > 0 ? (
          <div className="space-y-6 mb-8">
            {responses.map((response) => (
              <div key={response.id} className="border border-gray-200 rounded-md p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    {response.isFounder ? (
                      <div className="flex items-center">
                        <ProjectAvatar name={project.name} size="sm" />
                        <div className="ml-2">
                          <span className="font-medium text-gray-900">{response.authorName}</span>
                          <span className="ml-2 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-md">Founder</span>
                        </div>
                      </div>
                    ) : response.anonymousId && response.anonymousId === getAnonymousUserId() && !currentUser ? (
                      <div className="flex items-center text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-900">{response.authorName}</span>
                        <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">You</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-900">{response.authorName}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{formatRelativeTime(response.createdAt)}</div>
                </div>
                
                <div className="prose max-w-none whitespace-pre-line text-gray-700">
                  {response.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md p-6 text-center mb-8">
            <p className="text-gray-600">No responses yet. Be the first to respond!</p>
          </div>
        )}
      </div>
      
      {/* Add Response Form - Only visible if thread is not closed */}
      {thread.status !== 'closed' ? (
        <div className="border border-gray-200 rounded-md p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add a response</h3>
          
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
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                rows={4}
                placeholder="Type your response here..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {!currentUser && "You'll be assigned a persistent ID that will identify your responses."}
              </p>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50 text-sm"
              >
                {submitting ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md p-6 text-center mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-gray-700">This issue has been closed and is no longer accepting responses.</p>
        </div>
      )}
      
      {/* Back to Project Link */}
      <div className="text-center mb-12">
        <Link
          to={`/${projectSlug}`}
          className="text-gray-500 hover:text-gray-900 inline-flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to all issues
        </Link>
      </div>
    </div>
  );
};

export default ThreadPage; 