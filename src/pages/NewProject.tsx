import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FirebaseError } from 'firebase/app';
import ProjectAvatar from '../components/ProjectAvatar';
import ImageUpload from '../components/ImageUpload';

const NewProject = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl] = useState('');
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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
      setError('You must be logged in to create a project');
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
      
      const baseSlug = generateSlug(name);
      const slug = await getUniqueSlug(baseSlug);
      
      // Upload logo if one was selected
      let finalLogoUrl = logoUrl;
      if (selectedLogoFile) {
        try {
          finalLogoUrl = await uploadImage(selectedLogoFile);
        } catch (error) {
          console.error('Error uploading logo:', error);
          setError('Failed to upload logo image. Project creation aborted.');
          setLoading(false);
          return;
        }
      }
      
      // Create project document
      const projectRef = await addDoc(collection(db, 'projects'), {
        name,
        description,
        website: website || null,
        logoUrl: finalLogoUrl || null,
        slug,
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalIssues: 0,
        solvedIssues: 0,
      });
      
      console.log('Project created with ID:', projectRef.id);
      navigate(`/dashboard`);
    } catch (error) {
      console.error('Error creating project:', error);
      if (error instanceof FirebaseError) {
        setError(`Firebase error: ${error.message}`);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelected = (file: File) => {
    setSelectedLogoFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <h1 className="text-2xl font-medium text-gray-900 mb-8 pt-6">Create New Project</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
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
              Logo will be uploaded when you create the project
            </p>
          )}
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            ) : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewProject; 