import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, getDocs, FirestoreError, doc, getDoc, updateDoc } from 'firebase/firestore';
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
  const [displayName, setDisplayName] = useState('');
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