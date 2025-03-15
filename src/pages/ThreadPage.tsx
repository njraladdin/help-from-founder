import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment, deleteDoc, FieldValue } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { getAnonymousUserId, getAnonymousUserName } from '../lib/userUtils';
import { sendNewIssueNotification, getThreadParticipants } from '../lib/emailService';
import UserAvatar from '../components/UserAvatar';

// Configuration for closing reasons with respective styling
const closingReasonConfig = {
  solved: {
    key: 'solved',
    label: 'Solved',
    color: 'green',
    icon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    smallIcon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: 'This issue has been solved.'
  },
  'feature backlog': {
    key: 'feature backlog',
    label: 'Feature backlog',
    color: 'purple',
    icon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    smallIcon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    message: 'This feature has been added to the backlog.'
  },
  other: {
    key: 'other',
    label: 'Other',
    color: 'gray',
    icon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    smallIcon: (className: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: 'This issue has been closed.'
  }
};

interface Thread {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'closed';
  closingReason?: 'solved' | 'feature backlog' | 'other';
  closingNote?: string;
  closedBy?: string;
  createdAt: Date;
  authorName: string;
  authorId?: string;
  projectId: string;
  tag: string;
  anonymousId?: string;
  closedAt?: Date;
  updatedAt?: Date;
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
  // Add states for closing modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingReason, setClosingReason] = useState<'solved' | 'feature backlog' | 'other'>('solved');
  const [closingNote, setClosingNote] = useState('');
  const [isClosing, setIsClosing] = useState(false);

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
          closingReason: threadData.closingReason,
          closingNote: threadData.closingNote,
          closedBy: threadData.closedBy,
          createdAt: threadData.createdAt?.toDate() || new Date(),
          authorName: threadData.authorName,
          authorId: threadData.authorId,
          projectId: threadData.projectId,
          tag: threadData.tag || 'question',
          anonymousId: threadData.anonymousId,
          closedAt: threadData.closedAt?.toDate(),
          updatedAt: threadData.updatedAt?.toDate(),
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
      
      console.log('Creating response with:', {
        threadId: thread.id,
        authorName,
        anonymousId,
        isFounder
      });
      
      try {
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
      } catch (responseError) {
        console.error('Error creating response document:', responseError);
        setFormError(`Failed to create response: ${responseError instanceof Error ? responseError.message : 'Unknown error'}`);
        setSubmitting(false);
        return;
      }
      
      try {
        // Increment response count in thread document
        const threadRef = doc(db, 'threads', thread.id);
        await updateDoc(threadRef, {
          responseCount: increment(1)
        });
      } catch (threadError) {
        console.error('Error updating thread response count:', threadError);
        // Continue anyway since the response was created
      }
      
      // Create the issue URL
      const baseUrl = window.location.origin;
      const issueUrl = `${baseUrl}/${projectSlug}/thread/${threadId}`;
      
      // Get all thread participants who should receive a notification
      const participants = await getThreadParticipants(thread.id, currentUser?.uid || null);
      
      // Check if we should send email notifications
      let shouldSendEmails = true;
      
      // Check if the last response was from the same user and less than 1 hour ago
      if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        const now = new Date();
        const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
        const isWithinLastHour = now.getTime() - lastResponse.createdAt.getTime() < oneHourInMs;
        
        // Check if last response was from the same user (authenticated or anonymous)
        const isSameAuthor = 
          (currentUser?.uid && lastResponse.authorId === currentUser.uid) || 
          (!currentUser && lastResponse.anonymousId === getAnonymousUserId());
        
        // Don't send emails if both conditions are met
        if (isWithinLastHour && isSameAuthor) {
          console.log('Skipping email notification: Same user responded less than 1 hour ago');
          shouldSendEmails = false;
        }
      }
      
      // Only send notifications if there are recipients and we should send emails
      if (participants.length > 0 && shouldSendEmails) {
        // Send notification to all participants
        sendNewIssueNotification({
          type: 'new_response',
          projectId: project.id,
          projectName: project.name,
          issueId: thread.id,
          issueTitle: thread.title,
          responseContent: responseContent,
          responseAuthor: authorName,
          recipients: participants,
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

  const handleUpdateStatus = async (newStatus: 'open' | 'closed') => {
    if (!thread || !project || !currentUser) return;
    
    // Only the founder can update the status
    if (currentUser.uid !== project.ownerId) return;
    
    // If opening, just update status
    if (newStatus === 'open') {
      try {
        const threadRef = doc(db, 'threads', thread.id);
        await updateDoc(threadRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
          // Clear closing reason, note, and closedBy when reopening
          closingReason: null,
          closingNote: null,
          closedBy: null
        });
        
        // Decrement the closedIssues counter when reopening an issue
        const projectRef = doc(db, 'projects', thread.projectId);
        await updateDoc(projectRef, {
          closedIssues: increment(-1)
        });
        
        // Update local thread state
        setThread({
          ...thread,
          status: newStatus,
          closingReason: undefined,
          closingNote: undefined,
          closedBy: undefined
        });
      } catch (error) {
        console.error('Error updating thread status:', error);
      }
    } else {
      // For closing, show the modal instead of directly updating
      setShowCloseModal(true);
    }
  };

  const handleCloseThread = async () => {
    if (!thread || !project || !currentUser) return;
    
    try {
      setIsClosing(true);
      
      // Get the founder's name
      const founderName = currentUser.displayName || 'Founder';
      
      const threadRef = doc(db, 'threads', thread.id);
      await updateDoc(threadRef, {
        status: 'closed',
        closingReason: closingReason,
        closingNote: closingNote.trim() || null,
        closedBy: founderName,
        updatedAt: serverTimestamp(),
        closedAt: serverTimestamp(),
      });
      
      // Update the closedIssues counter for all closed issues
      const projectRef = doc(db, 'projects', thread.projectId);
      await updateDoc(projectRef, {
        closedIssues: increment(1)
      });
      
      // Update local thread state
      const now = new Date();
      setThread({
        ...thread,
        status: 'closed',
        closingReason: closingReason,
        closingNote: closingNote.trim() || undefined,
        closedBy: founderName,
        updatedAt: now,
        closedAt: now,
      });
      
      // Close the modal
      setShowCloseModal(false);
      setClosingNote('');
    } catch (error) {
      console.error('Error closing thread:', error);
    } finally {
      setIsClosing(false);
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
      const updateData: { totalIssues: FieldValue; closedIssues?: FieldValue } = {
        totalIssues: increment(-1)
      };
      
      // If thread was closed, also decrement closedIssues
      if (thread.status === 'closed') {
        updateData.closedIssues = increment(-1);
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
        return (
          <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11v8a1 1 0 001 1h8a1 1 0 001-1v-8m-10 0V9a3 3 0 013-3h4a3 3 0 013 3v2m-10 0h10" />
            </svg>
            Open
          </span>
        );
      case 'closed': {
        // Get the appropriate config for this closing reason
        const reasonKey = thread?.closingReason || 'other';
        const config = closingReasonConfig[reasonKey as keyof typeof closingReasonConfig] || closingReasonConfig.other;
        
        return (
          <span className={`px-2 py-1 bg-${config.color}-50 text-${config.color}-600 text-xs rounded-md flex items-center`}>
            {config.icon("h-3.5 w-3.5 mr-1")}
            {config.label}
          </span>
        );
      }
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
            {getStatusBadge(thread.status as string)}
            {getTagBadge(thread.tag)}
          </div>
        </div>
        
        <h1 className="text-2xl font-medium text-gray-900 mb-4">{thread.title}</h1>
        
        <div className="flex items-center mb-6">
          <UserAvatar 
            name={thread.authorName}
            size="sm"
            className="flex-shrink-0"
          />
          <div className="ml-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{thread.authorName}</span>
            <span className="mx-2">·</span>
            <span>{formatRelativeTime(thread.createdAt)}</span>
            {((!currentUser && thread.anonymousId === getAnonymousUserId()) || 
              (currentUser && currentUser.uid === thread.authorId)) && (
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
            {/* Before closed responses */}
            {(thread.status as string) === 'closed' && thread.closedAt ? (
              // If thread is closed, split responses into before and after closing
              responses
                .filter(response => new Date(response.createdAt) < new Date(thread.closedAt as Date))
                .map((response) => (
                  <div 
                    key={response.id} 
                    className={`border border-gray-200 rounded-lg overflow-hidden ${response.isFounder ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className={`flex items-center justify-between px-4 py-3 ${response.isFounder ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center">
                        <UserAvatar 
                          name={response.authorName}
                          size="sm"
                          className={`mr-2 ${response.isFounder ? 'ring-2 ring-blue-500' : ''}`}
                        />
                        <div>
                          <span className="font-medium text-gray-900">{response.authorName}</span>
                          {response.isFounder && (
                            <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                              Founder
                            </span>
                          )}
                          {((!currentUser && response.anonymousId === getAnonymousUserId()) || 
                            (currentUser && currentUser.uid === response.authorId)) && (
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
                ))
            ) : (
              // If thread is open, show all responses
              responses.map((response) => (
                <div 
                  key={response.id} 
                  className={`border border-gray-200 rounded-lg overflow-hidden ${response.isFounder ? 'border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className={`flex items-center justify-between px-4 py-3 ${response.isFounder ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center">
                      <UserAvatar 
                        name={response.authorName}
                        size="sm"
                        className={`mr-2 ${response.isFounder ? 'ring-2 ring-blue-500' : ''}`}
                      />
                      <div>
                        <span className="font-medium text-gray-900">{response.authorName}</span>
                        {response.isFounder && (
                          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                            Founder
                          </span>
                        )}
                        {((!currentUser && response.anonymousId === getAnonymousUserId()) || 
                          (currentUser && currentUser.uid === response.authorId)) && (
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
              ))
            )}
            
            {/* Closing information */}
            {(thread.status as string) === 'closed' && (
              <div className={`border border-gray-200 rounded-lg overflow-hidden border-l-4 ${
                // Get the appropriate config based on closing reason
                (thread.closingReason ? 
                  `border-l-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-500` : 
                  `border-l-${closingReasonConfig.other.color}-500`)
              }`}>
                <div className={`flex items-center justify-between px-4 py-3 ${
                  // Get the appropriate background color
                  (thread.closingReason ? 
                    `bg-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-50` : 
                    `bg-${closingReasonConfig.other.color}-50`)
                }`}>
                  <div className="flex items-center">
                    <UserAvatar 
                      name={thread.closedBy || 'Founder'}
                      size="sm"
                      className={`mr-2 ring-2 ${
                        // Get the appropriate ring color
                        (thread.closingReason ? 
                          `ring-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-500` : 
                          `ring-${closingReasonConfig.other.color}-500`)
                      }`}
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        {thread.closedBy ? `Thread closed by ${thread.closedBy}` : 'Thread closed by founder'}
                      </span>
                      {thread.closingReason && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full inline-flex items-center ${
                          `bg-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-100 text-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-700`
                        }`}>
                          {closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].icon("h-3.5 w-3.5 mr-1")}
                          {closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {thread.closedAt ? formatRelativeTime(thread.closedAt as Date) : formatRelativeTime(thread.updatedAt || thread.createdAt)}
                  </div>
                </div>
                
                <div className="px-4 py-4 bg-white">
                  <div className="prose max-w-none text-gray-700">
                    <div className="flex items-start">
                      {thread.closingReason ? (
                        <>
                          {closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].smallIcon(`h-5 w-5 mr-2 flex-shrink-0 text-${closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].color}-500`)}
                          <div className="flex-1">
                            <p className="font-medium mb-2">
                              {closingReasonConfig[thread.closingReason as keyof typeof closingReasonConfig].message}
                            </p>
                            
                            {thread.closingNote && (
                              <p className="mb-2">{thread.closingNote}</p>
                            )}
                            <p className="text-sm text-gray-600">
                              This thread is closed but you can still add responses if you have additional information.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {closingReasonConfig.other.smallIcon(`h-5 w-5 text-${closingReasonConfig.other.color}-500 mr-2 flex-shrink-0`)}
                          <div className="flex-1">
                            <p className="font-medium mb-2">{closingReasonConfig.other.message}</p>
                            
                            {thread.closingNote && (
                              <p className="mb-2">{thread.closingNote}</p>
                            )}
                            <p className="text-sm text-gray-600">
                              This thread is closed but you can still add responses if you have additional information.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* After closed responses */}
            {(thread.status as string) === 'closed' && thread.closedAt && 
              responses
                .filter(response => new Date(response.createdAt) >= new Date(thread.closedAt as Date))
                .map((response) => (
                  <div 
                    key={response.id} 
                    className={`border border-gray-200 rounded-lg overflow-hidden ${response.isFounder ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className={`flex items-center justify-between px-4 py-3 ${response.isFounder ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center">
                        <UserAvatar 
                          name={response.authorName}
                          size="sm"
                          className={`mr-2 ${response.isFounder ? 'ring-2 ring-blue-500' : ''}`}
                        />
                        <div>
                          <span className="font-medium text-gray-900">{response.authorName}</span>
                          {response.isFounder && (
                            <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                              Founder
                            </span>
                          )}
                          {((!currentUser && response.anonymousId === getAnonymousUserId()) || 
                            (currentUser && currentUser.uid === response.authorId)) && (
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
                ))
            }
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
      
      {/* Sign up prompt for anonymous users who created the thread or responded in it */}
      {!currentUser && (thread.status as string) !== 'closed' && 
        (thread.anonymousId === getAnonymousUserId() || 
         responses.some(response => response.anonymousId === getAnonymousUserId())) && (
        <div className="border border-blue-200 rounded-lg p-5 mb-8 bg-blue-50">
          <div className="flex items-start">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-full mr-4 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-blue-800 mb-1">Get notified about this thread</h3>
              <p className="text-sm text-blue-700 mb-3">
                Create an account to receive email notifications when the founder responds to this thread.
              </p>
              <Link
                to={`/register?redirect=${encodeURIComponent(`/${projectSlug}/thread/${threadId}`)}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Thread Actions Section for Founders */}
      {isFounder && (
        <div className="mb-6">
          {(thread.status as string) === 'closed' ? (
            <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-700 font-medium">Thread closed</span>
              </div>
              <button
                onClick={() => handleUpdateStatus('open')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Reopen Thread
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700 font-medium">Founder Actions</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Delete Thread
                </button>
                <button
                  onClick={() => handleUpdateStatus('closed')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Close Thread
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Add Response Form - Only visible if thread is not closed */}
      {(thread.status as string) !== 'closed' ? (
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
        <div className="border border-gray-200 rounded-lg p-6 mb-8 shadow-sm bg-white">
          <div className="bg-amber-50 border border-amber-100 rounded-md p-3 mb-5 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-amber-800 font-medium">This thread has been marked as closed by the founder</p>
              <p className="text-sm text-amber-700 mt-1">You can still add your response, but the issue may have already been addressed.</p>
            </div>
          </div>
        
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

      {/* Add this Close Issue Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full mx-auto p-6 shadow-xl animate-scale-in">
            <h3 className="text-xl font-medium text-gray-900 mb-4">Close This Issue</h3>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for closing</label>
              <div className="space-y-3">
                {/* Solved option */}
                <label className={`flex items-start p-3 border rounded-md cursor-pointer ${
                  closingReason === 'solved' 
                    ? `border-${closingReasonConfig.solved.color}-500 bg-${closingReasonConfig.solved.color}-50` 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input 
                    type="radio" 
                    name="closingReason" 
                    value="solved"
                    checked={closingReason === 'solved'} 
                    onChange={() => setClosingReason('solved')}
                    className="mr-3 mt-0.5"
                  />
                  <div>
                    <div className="flex items-center">
                      {closingReasonConfig.solved.icon(`h-4 w-4 text-${closingReasonConfig.solved.color}-500 mr-2`)}
                      <span className="font-medium text-gray-900">Issue solved</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Mark this issue as resolved and show users that a solution was found.
                    </p>
                  </div>
                </label>

                {/* Feature backlog option */}
                <label className={`flex items-start p-3 border rounded-md cursor-pointer ${
                  closingReason === 'feature backlog' 
                    ? `border-${closingReasonConfig['feature backlog'].color}-500 bg-${closingReasonConfig['feature backlog'].color}-50` 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input 
                    type="radio" 
                    name="closingReason" 
                    value="feature backlog"
                    checked={closingReason === 'feature backlog'} 
                    onChange={() => setClosingReason('feature backlog')}
                    className="mr-3 mt-0.5"
                  />
                  <div>
                    <div className="flex items-center">
                      {closingReasonConfig['feature backlog'].icon(`h-4 w-4 text-${closingReasonConfig['feature backlog'].color}-500 mr-2`)}
                      <span className="font-medium text-gray-900">Added to feature backlog</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Close this thread and indicate that this feature request will be considered for future development.
                    </p>
                  </div>
                </label>

                {/* Other option */}
                <label className={`flex items-start p-3 border rounded-md cursor-pointer ${
                  closingReason === 'other' 
                    ? `border-${closingReasonConfig.other.color}-500 bg-${closingReasonConfig.other.color}-50` 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input 
                    type="radio" 
                    name="closingReason" 
                    value="other"
                    checked={closingReason === 'other'} 
                    onChange={() => setClosingReason('other')}
                    className="mr-3 mt-0.5"
                  />
                  <div>
                    <div className="flex items-center">
                      {closingReasonConfig.other.icon(`h-4 w-4 text-${closingReasonConfig.other.color}-500 mr-2`)}
                      <span className="font-medium text-gray-900">Other reason</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Close this thread for another reason (please explain in the note below).
                    </p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Closing note (optional)
              </label>
              <textarea
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Add any additional context about why this issue is being closed..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                disabled={isClosing}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseThread}
                className={`px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm disabled:opacity-70 ${
                  closingReason === 'solved' 
                    ? `bg-${closingReasonConfig.solved.color}-600 hover:bg-${closingReasonConfig.solved.color}-700` 
                    : closingReason === 'feature backlog' 
                      ? `bg-${closingReasonConfig['feature backlog'].color}-600 hover:bg-${closingReasonConfig['feature backlog'].color}-700` 
                      : `bg-${closingReasonConfig.other.color}-600 hover:bg-${closingReasonConfig.other.color}-700`
                }`}
                disabled={isClosing}
              >
                {isClosing ? 'Closing...' : 'Close Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadPage; 