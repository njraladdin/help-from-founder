import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ProjectAvatar from '../components/ProjectAvatar';

interface Project {
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  logoUrl?: string;
  totalIssues?: number;
  solvedIssues?: number;
  website?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

const Home = () => {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedProjects = async () => {
      try {
        // Query for the most recent projects
        const projectsRef = collection(db, 'projects');
        // Since we don't have the index yet, we'll get all projects and sort them client-side
        const projectsSnapshot = await getDocs(projectsRef);
        
        const projectsData: Project[] = [];
        projectsSnapshot.forEach((doc) => {
          const data = doc.data();
          projectsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            slug: data.slug,
            createdAt: data.createdAt?.toDate() || new Date(),
            logoUrl: data.logoUrl,
            totalIssues: data.totalIssues || 0,
            solvedIssues: data.solvedIssues || 0,
            website: data.website,
            twitterUrl: data.twitterUrl,
            linkedinUrl: data.linkedinUrl,
            githubUrl: data.githubUrl,
          });
        });
        
        // Sort by creation date (newest first)
        const sortedProjects = projectsData
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setFeaturedProjects(sortedProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProjects();
  }, []);

  // Calculate the percentage of solved issues
  const getSolvedPercentage = (totalIssues: number, solvedIssues: number) => {
    if (totalIssues === 0) return 0;
    return Math.round((solvedIssues / totalIssues) * 100);
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Hero Section - Refined with clearer value proposition */}
      <div className="py-20 text-center">
        <h1 className="text-4xl font-semibold text-gray-900 mb-4">Direct Help from Founders</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Ask questions and get answers directly from the people who built the products you use.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            I'm a Founder
          </Link>
          <a
            href="#projects"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Find Projects
          </a>
        </div>
      </div>

      {/* How It Works - More visual, less numbered */}
      <div className="mb-20 py-14 border-t border-b border-gray-100">
        <h2 className="text-2xl font-medium text-gray-900 mb-10 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-center text-center">
            <div className="bg-blue-50 rounded-full w-14 h-14 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-lg mb-2">Find a Project</h3>
            <p className="text-gray-600">
              Discover the projects you need help with
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="bg-blue-50 rounded-full w-14 h-14 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-lg mb-2">Ask Your Question</h3>
            <p className="text-gray-600">
              Submit questions without creating an account
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="bg-blue-50 rounded-full w-14 h-14 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-lg mb-2">Get a Response</h3>
            <p className="text-gray-600">
              Receive answers directly from the founders
            </p>
          </div>
        </div>
      </div>

      {/* Projects List - More refined */}
      <div id="projects" className="mb-20">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-medium text-gray-900">Available Projects</h2>
          {featuredProjects.length > 0 && (
            <p className="text-sm text-gray-500">
              {featuredProjects.length} project{featuredProjects.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : featuredProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {featuredProjects.map((project) => (
              <Link 
                key={project.id} 
                to={`/${project.slug}`}
                className="block border border-gray-200 hover:border-gray-300 rounded-lg p-5 transition-all hover:shadow-sm group"
              >
                <div className="flex items-start gap-4">
                  {project.logoUrl ? (
                    <img 
                      src={project.logoUrl} 
                      alt={`${project.name} logo`} 
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <ProjectAvatar name={project.name} size="md" />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                      
                      {/* Issue metrics */}
                      {(project.totalIssues ?? 0) > 0 && (
                        <div className="flex items-center gap-3 mt-1 md:mt-0">
                          <span className="inline-flex items-center text-sm text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            {project.totalIssues ?? 0} questions
                          </span>
                          
                          {(project.solvedIssues ?? 0) > 0 && (
                            <span className="inline-flex items-center text-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-green-600 font-medium">
                                {getSolvedPercentage(project.totalIssues ?? 0, project.solvedIssues ?? 0)}% solved
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-base mb-3 line-clamp-2">{project.description}</p>
                    
                    {/* Bottom row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {project.website && (
                          <a 
                            href={project.website} 
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-500 hover:text-gray-800 text-sm flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {project.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        )}
                      </div>
                      
                      {/* Ask question CTA */}
                      <span className="text-sm text-blue-600 group-hover:underline flex items-center">
                        Ask a question
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-10 text-center bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Be the first to create a project and start getting direct feedback from your users.
            </p>
            <Link
              to="/login"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              Create Your Project
            </Link>
          </div>
        )}
      </div>

      {/* For Founders - More compelling */}
      <div className="mb-16 py-14 px-8 border border-gray-200 rounded-lg bg-gray-50 text-center">
        <h2 className="text-2xl font-medium text-gray-900 mb-3">For Founders</h2>
        <p className="text-gray-600 mb-6 max-w-xl mx-auto">
          Create a dedicated page for your project where users can ask questions and get direct answers from you. Build trust with your community through personal communication.
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          Start Your Project Page
        </Link>
      </div>
    </div>
  );
};

export default Home; 