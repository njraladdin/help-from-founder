const Footer = () => {
  return (
    <footer className="border-t border-gray-200 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Help From Founder</p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
              Terms
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
              Privacy
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 