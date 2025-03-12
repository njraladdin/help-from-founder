import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc, getDoc, serverTimestamp, FirestoreError, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ProjectAvatar from '../components/ProjectAvatar';
import ImageUpload from '../components/ImageUpload';

const EditProject = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [originalSlug, setOriginalSlug] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Worker URL for image upload
  const WORKER_URL = import.meta.env.VITE_WORKER_URL;

  // Generate a slug from the project name
  const generateSlug = (projectName: string) => {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 60); // Limit length
  };

  // Check if a slug is already in use
  const isSlugAvailable = async (slug: string) => {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('slug', '==', slug));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  };

  // Get a unique slug by appending a number if needed
  const getUniqueSlug = async (baseSlug: string) => {
    let slug = baseSlug;
    let counter = 1;
    let isAvailable = await isSlugAvailable(slug);
    
    while (!isAvailable) {
      slug = `${baseSlug}-${counter}`;
      counter++;
      isAvailable = await isSlugAvailable(slug);
    }
    
    return slug;
  };

  // Fetch project data when component mounts
  useEffect(() => {
    const fetchProject = async () => {
      if (!currentUser || !projectId) {
        setError('Missing required information');
        setFetchLoading(false);
        return;
      }

      try {
        setFetchLoading(true);
        setError(null);
        
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        
        if (!projectDoc.exists()) {
          setError('Project not found');
          setFetchLoading(false);
          return;
        }
        
        const projectData = projectDoc.data();
        
        // Check if the current user is the owner of the project
        if (projectData.ownerId !== currentUser.uid) {
          setError('You do not have permission to edit this project');
          setFetchLoading(false);
          return;
        }
        
        // Set the project data to state
        setName(projectData.name);
        setDescription(projectData.description);
        setWebsite(projectData.website || '');
        setLogoUrl(projectData.logoUrl || '');
        setTwitterUrl(projectData.twitterUrl || '');
        setLinkedinUrl(projectData.linkedinUrl || '');
        setGithubUrl(projectData.githubUrl || '');
        setOriginalSlug(projectData.slug);
        
      } catch (error) {
        console.error('Error fetching project:', error);
        if (error instanceof FirestoreError) {
          setError(`Firebase error: ${error.message}`);
        } else {
          setError('Failed to load project. Please try again.');
        }
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProject();
  }, [currentUser, projectId]);

  // Upload image to R2 via worker
  const uploadImage = async (file: File): Promise<string> => {
    // Create a FormData object
    const formData = new FormData();
    formData.append('file', file);

    // Upload directly to our worker
    const response = await fetch(`${WORKER_URL}/api/images/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success || !data.key) {
      throw new Error(data.error || 'Failed to upload image');
    }

    // Construct the final image URL
    return `${WORKER_URL}/api/images/${data.key}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to edit a project');
      return;
    }
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    
    if (!description.trim()) {
      setError('Project description is required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      let slug = originalSlug;
      
      // If name has changed, generate a new slug
      if (generateSlug(name) !== originalSlug) {
        const baseSlug = generateSlug(name);
        slug = await getUniqueSlug(baseSlug);
      }
      
      // Upload logo if one was selected
      let finalLogoUrl = logoUrl;
      if (selectedLogoFile) {
        try {
          finalLogoUrl = await uploadImage(selectedLogoFile);
        } catch (error) {
          console.error('Error uploading logo:', error);
          setError('Failed to upload logo image. Project update aborted.');
          setLoading(false);
          return;
        }
      }
      
      // Update project document
      await updateDoc(doc(db, 'projects', projectId!), {
        name,
        description,
        website: website || null,
        logoUrl: finalLogoUrl || null,
        twitterUrl: twitterUrl || null,
        linkedinUrl: linkedinUrl || null,
        githubUrl: githubUrl || null,
        slug,
        updatedAt: serverTimestamp(),
      });
      
      setSuccess('Project updated successfully');
      setTimeout(() => {
        navigate(`/dashboard`);
      }, 1500);
    } catch (error) {
      console.error('Error updating project:', error);
      if (error instanceof FirestoreError) {
        setError(`Firebase error: ${error.message}`);
      } else {
        setError('Failed to update project. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelected = (file: File) => {
    setSelectedLogoFile(file);
  };

  if (fetchLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <h1 className="text-2xl font-medium text-gray-900 mb-8 pt-6">Edit Project</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-md mb-6 text-sm">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-gray-700 mb-2 text-sm">
            Project Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            required
          />
        </div>
        
        {name && (
          <div className="flex items-center space-x-4 py-2">
            <ProjectAvatar name={name} size="md" imageUrl={logoUrl} />
            <div>
              <p className="text-sm text-gray-500">
                Project URL will be: <span className="font-mono">{window.location.origin}/{generateSlug(name)}</span>
              </p>
              {originalSlug !== generateSlug(name) && (
                <p className="text-xs text-amber-600 mt-1">
                  Note: Changing the project name will update the URL
                </p>
              )}
            </div>
          </div>
        )}
        
        <div>
          <label htmlFor="description" className="block text-gray-700 mb-2 text-sm">
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 min-h-32"
            rows={4}
            required
          />
        </div>
        
        <div>
          <label htmlFor="website" className="block text-gray-700 mb-2 text-sm">
            Website (optional)
          </label>
          <input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            placeholder="https://example.com"
          />
        </div>
        
        {/* Social Media Links */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Social Media Links (optional)</h3>
          
          <div>
            <label htmlFor="twitterUrl" className="block text-gray-700 mb-2 text-sm">
              Twitter/X
            </label>
            <input
              id="twitterUrl"
              type="url"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              placeholder="https://twitter.com/username"
            />
          </div>
          
          <div>
            <label htmlFor="linkedinUrl" className="block text-gray-700 mb-2 text-sm">
              LinkedIn
            </label>
            <input
              id="linkedinUrl"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              placeholder="https://linkedin.com/in/username"
            />
          </div>
          
          <div>
            <label htmlFor="githubUrl" className="block text-gray-700 mb-2 text-sm">
              GitHub
            </label>
            <input
              id="githubUrl"
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              placeholder="https://github.com/username"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2 text-sm">
            Project Logo (optional)
          </label>
          <ImageUpload 
            onFileSelected={handleFileSelected} 
            currentImageUrl={logoUrl}
          />
          {selectedLogoFile && (
            <p className="mt-1 text-xs text-gray-500">
              Logo will be uploaded when you save changes
            </p>
          )}
        </div>
        
        <div className="pt-4 flex items-center space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProject; 