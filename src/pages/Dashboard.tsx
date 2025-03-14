import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, getDocs, FirestoreError, doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../lib/firebase';
import ProjectAvatar from '../components/ProjectAvatar';
import UserAvatar from '../components/UserAvatar';

interface Project {
  id: string;
  name: string;
  description: string;
  slug: string;
  website?: string;
  createdAt: Date;
  logoUrl?: string;
  totalIssues?: number;
  solvedIssues?: number;
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // User profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSocial, setIsEditingSocial] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);
  const [userCreationDate, setUserCreationDate] = useState<Date | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      
      // Extract user creation time
      if (currentUser.metadata.creationTime) {
        setUserCreationDate(new Date(currentUser.metadata.creationTime));
      }
      
      // Fetch user's social media profiles
      const fetchUserProfile = async () => {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setTwitterUrl(userData.twitterUrl || '');
            setLinkedinUrl(userData.linkedinUrl || '');
            setGithubUrl(userData.githubUrl || '');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      };
      
      fetchUserProfile();
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!currentUser) return;

      try {
        setError(null);
        const q = query(
          collection(db, 'projects'),
          where('ownerId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const projectsData: Project[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          projectsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            slug: data.slug,
            website: data.website || undefined,
            createdAt: data.createdAt?.toDate() || new Date(),
            logoUrl: data.logoUrl,
            totalIssues: data.totalIssues || 0,
            solvedIssues: data.solvedIssues || 0,
            twitterUrl: data.twitterUrl,
            linkedinUrl: data.linkedinUrl,
            githubUrl: data.githubUrl,
          });
        });

        projectsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setProjects(projectsData);
      } catch (error) {
        console.error('Error fetching projects:', error);
        
        if (error instanceof FirestoreError) {
          if (error.code === 'permission-denied') {
            setError('You do not have permission to access these projects.');
          } else {
            setError(`Database error: ${error.message}`);
          }
        } else {
          setError('Failed to load projects. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [currentUser]);

  // Calculate the percentage of solved issues
  const getSolvedPercentage = (totalIssues: number, solvedIssues: number) => {
    if (totalIssues === 0) return 0;
    return Math.round((solvedIssues / totalIssues) * 100);
  };

  // Handle display name update
  const handleUpdateDisplayName = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    if (!displayName.trim()) {
      setProfileUpdateError('Display name cannot be empty');
      return;
    }
    
    try {
      setUpdatingProfile(true);
      setProfileUpdateError(null);
      
      // Update display name in Firebase Authentication
      await updateProfile(currentUser, {
        displayName: displayName.trim()
      });
      
      // Also update the display name in Firestore if you store user data there
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          await updateDoc(userDocRef, {
            displayName: displayName.trim()
          });
        }
      } catch (error) {
        console.error('Error updating user document:', error);
        // Continue anyway since the auth profile was updated
      }
      
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating display name:', error);
      setProfileUpdateError('Failed to update display name. Please try again.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Handle social media links update
  const handleUpdateSocialLinks = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    try {
      setUpdatingProfile(true);
      setProfileUpdateError(null);
      
      // Update social media links in Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      const socialData = {
        twitterUrl: twitterUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        githubUrl: githubUrl.trim() || null,
        updatedAt: serverTimestamp()
      };
      
      if (userDoc.exists()) {
        await updateDoc(userDocRef, socialData);
      } else {
        // If user document doesn't exist yet, create it with display name too
        await setDoc(userDocRef, {
          ...socialData,
          displayName: currentUser.displayName || '',
          email: currentUser.email,
          uid: currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
      
      setIsEditingSocial(false);
    } catch (error) {
      console.error('Error updating social media links:', error);
      setProfileUpdateError('Failed to update social media links. Please try again.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* User Profile Section */}
      {currentUser && (
        <div className="border border-gray-200 rounded-md p-6 mb-8 mt-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Your Profile</h2>
          
          <div className="flex items-start space-x-4">
            <UserAvatar 
              name={currentUser.displayName || currentUser.email || 'User'} 
              size="lg"
            />
            
            <div className="flex-1">
              {isEditingName ? (
                <form onSubmit={handleUpdateDisplayName} className="mb-4">
                  <div className="mb-3">
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your name"
                    />
                    {profileUpdateError && (
                      <p className="text-red-600 text-sm mt-1">{profileUpdateError}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={updatingProfile}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                    >
                      {updatingProfile ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setDisplayName(currentUser.displayName || '');
                        setProfileUpdateError(null);
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {currentUser.displayName || 'No display name set'}
                    </h3>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="ml-2 text-blue-600 text-sm hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-gray-600 mt-1">{currentUser.email}</p>
                </div>
              )}
              
              <div className="text-sm text-gray-500">
                Account created: {userCreationDate ? userCreationDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Unknown'}
              </div>
              
              {/* Social Media Links Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Social Media Links</h4>
                  {!isEditingSocial ? (
                    <button
                      onClick={() => setIsEditingSocial(true)}
                      className="text-blue-600 text-sm hover:text-blue-800"
                    >
                      {twitterUrl || linkedinUrl || githubUrl ? 'Edit' : 'Add'}
                    </button>
                  ) : null}
                </div>
                
                {isEditingSocial ? (
                  <form onSubmit={handleUpdateSocialLinks} className="space-y-3">
                    <div>
                      <label htmlFor="twitterUrl" className="block text-xs text-gray-600 mb-1">
                        Twitter/X
                      </label>
                      <input
                        type="url"
                        id="twitterUrl"
                        value={twitterUrl}
                        onChange={(e) => setTwitterUrl(e.target.value)}
                        className="w-full md:w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://twitter.com/username"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="linkedinUrl" className="block text-xs text-gray-600 mb-1">
                        LinkedIn
                      </label>
                      <input
                        type="url"
                        id="linkedinUrl"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="w-full md:w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="githubUrl" className="block text-xs text-gray-600 mb-1">
                        GitHub
                      </label>
                      <input
                        type="url"
                        id="githubUrl"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="w-full md:w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://github.com/username"
                      />
                    </div>
                    
                    <div className="flex space-x-2 pt-1">
                      <button
                        type="submit"
                        disabled={updatingProfile}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {updatingProfile ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingSocial(false);
                          // Reset to original values
                          const fetchOriginal = async () => {
                            try {
                              const userDocRef = doc(db, 'users', currentUser.uid);
                              const userDoc = await getDoc(userDocRef);
                              
                              if (userDoc.exists()) {
                                const userData = userDoc.data();
                                setTwitterUrl(userData.twitterUrl || '');
                                setLinkedinUrl(userData.linkedinUrl || '');
                                setGithubUrl(userData.githubUrl || '');
                              }
                            } catch (error) {
                              console.error('Error fetching user profile:', error);
                            }
                          };
                          fetchOriginal();
                          setProfileUpdateError(null);
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1">
                    {twitterUrl || linkedinUrl || githubUrl ? (
                      <>
                        {twitterUrl && (
                          <a 
                            href={twitterUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-gray-600 hover:text-gray-800 text-sm group"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            {twitterUrl.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '')}
                          </a>
                        )}
                        
                        {linkedinUrl && (
                          <a 
                            href={linkedinUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-gray-600 hover:text-gray-800 text-sm group"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            {linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/(in|company)\//, '')}
                          </a>
                        )}
                        
                        {githubUrl && (
                          <a 
                            href={githubUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-gray-600 hover:text-gray-800 text-sm group"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                            </svg>
                            {githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">No social media links added</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Projects Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10">
        <h1 className="text-2xl font-medium text-gray-900 mb-4 md:mb-0">Your Projects</h1>
        <Link
          to="/dashboard/new-project"
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
        >
          Create New Project
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-800"></div>
        </div>
      ) : projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="border border-gray-200 rounded-md p-6 hover:border-gray-300 transition-colors">
              <div className="flex items-start space-x-4 mb-4">
                {project.logoUrl ? (
                  <img 
                    src={project.logoUrl} 
                    alt={`${project.name} logo`} 
                    className="w-12 h-12 rounded-md object-cover"
                  />
                ) : (
                  <ProjectAvatar name={project.name} size="md" />
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap justify-between items-start">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">{project.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Created on {project.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="mt-1 md:mt-0 flex items-center space-x-2">
                      {(project.totalIssues ?? 0) > 0 ? (
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {project.totalIssues} issues
                          </div>
                          <div className="text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100">
                            <span className={(project.solvedIssues ?? 0) > 0 ? 'text-green-600' : 'text-gray-500'}>
                              {getSolvedPercentage(project.totalIssues ?? 0, project.solvedIssues ?? 0)}% solved
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No issues yet</div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mt-3 mb-4 line-clamp-2">{project.description}</p>
                  
                  {project.website && (
                    <a 
                      href={project.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {project.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap justify-between items-center mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3 md:mb-0">
                  Public URL: <span className="font-mono">{window.location.origin}/{project.slug}</span>
                </p>
                <div className="space-x-2">
                  <Link
                    to={`/${project.slug}`}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors text-sm"
                  >
                    View
                  </Link>
                  <Link
                    to={`/dashboard/edit-project/${project.id}`}
                    className="px-3 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-gray-200 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h2>
          <p className="text-gray-600 mb-6 text-sm max-w-md mx-auto">
            Create your first project to get started. This will create a page where users can submit questions or issues.
          </p>
          <Link
            to="/dashboard/new-project"
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            Create Your First Project
          </Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 