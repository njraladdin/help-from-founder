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
      {/* Hero Section - Minimalist */}
      <div className="py-16">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">Help From Founder</h1>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          A simple platform for users to ask questions and report issues directly to project founders — 
          no account needed.
        </p>
        <div className="space-x-4">
          <Link
            to="/login"
            className="px-5 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            I'm a Founder
          </Link>
          <a
            href="#projects"
            className="px-5 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
          >
            Browse Projects
          </a>
        </div>
      </div>

      {/* How It Works - Simple 3 steps */}
      <div className="mb-16 border-t border-b border-gray-200 py-10">
        <h2 className="text-2xl font-medium text-gray-900 mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="font-mono text-sm text-gray-500">01</div>
            <h3 className="font-medium text-gray-900">Find a Project</h3>
            <p className="text-gray-600 text-sm">
              Browse projects and find the one you need help with
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-sm text-gray-500">02</div>
            <h3 className="font-medium text-gray-900">Ask a Question</h3>
            <p className="text-gray-600 text-sm">
              Submit your question or report an issue, no account required
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-sm text-gray-500">03</div>
            <h3 className="font-medium text-gray-900">Get a Response</h3>
            <p className="text-gray-600 text-sm">
              Receive a direct response from the project founder
            </p>
          </div>
        </div>
      </div>

      {/* Projects List - More like Hacker News */}
      <div id="projects" className="mb-16">
        <h2 className="text-2xl font-medium text-gray-900 mb-6">Projects</h2>
        
        {loading ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : featuredProjects.length > 0 ? (
          <div className="space-y-4">
            {featuredProjects.map((project, index) => (
              <Link 
                key={project.id} 
                to={`/${project.slug}`}
                className="block border border-gray-200 hover:border-gray-300 rounded-md p-4 transition-colors group"
              >
                <div className="flex items-start">
                  <div className="text-gray-400 mr-3 font-mono text-sm pt-1">{index + 1}</div>
                  <div className="mr-4">
                    {project.logoUrl ? (
                      <img 
                        src={project.logoUrl} 
                        alt={`${project.name} logo`} 
                        className="w-12 h-12 rounded-md object-cover"
                      />
                    ) : (
                      <ProjectAvatar name={project.name} size="md" />
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <div className="flex flex-wrap items-center justify-between">
                      <h3 className="text-base font-medium text-gray-900 group-hover:text-gray-700">{project.name}</h3>
                      
                      {/* Subtle issue indicators */}
                      <div className="flex items-center space-x-2 mt-1 md:mt-0">
                        <span className="text-xs text-gray-500 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          {project.totalIssues || 0} issues
                        </span>
                        
                        <span className="text-xs flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className={(project.solvedIssues ?? 0) > 0 ? 'text-green-600' : 'text-gray-500'}>
                            {getSolvedPercentage(project.totalIssues ?? 0, project.solvedIssues ?? 0)}% solved
                          </span>
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{project.description}</p>
                    <div className="flex items-center text-sm text-gray-500 mt-2">
                      {/* <span>{new Date(project.createdAt).toLocaleDateString()}</span> */}
                      {project.website && (
                        <a 
                          href={project.website} 
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-4 text-gray-500 hover:text-gray-700 inline-flex items-center text-xs"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {project.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      )}
                    </div>
                    
                    {/* Add a subtle arrow icon that appears on hover */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 text-gray-400"
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md p-8 text-center">
            <p className="text-gray-600 mb-4">No projects yet</p>
            <Link
              to="/login"
              className="inline-block px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
            >
              Add Your Project
            </Link>
          </div>
        )}
      </div>

      {/* For Founders - Simple CTA */}
      <div className="mb-16 py-8 border-t border-gray-200">
        <h2 className="text-2xl font-medium text-gray-900 mb-4">For Founders</h2>
        <p className="text-gray-600 mb-6">
          Create a dedicated page for your project, manage user questions, and build a helpful knowledge base.
        </p>
        <Link
          to="/login"
          className="inline-block px-5 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          Create Your Project Page
        </Link>
      </div>
    </div>
  );
};

export default Home; 