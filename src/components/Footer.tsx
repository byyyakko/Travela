import { MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-16 bg-foreground text-background">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-semibold">
                LocalConnect
              </span>
            </a>
            <p className="text-background/70 text-sm">
              Connecting travelers with passionate locals for authentic experiences worldwide.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Explore</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li><a href="/auth" className="hover:text-background transition-colors">Browse Locals</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Destinations</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Experiences</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Food Tours</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Community</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li><a href="/auth" className="hover:text-background transition-colors">Become a Guide</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Success Stories</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Blog</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Events</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li><a href="/auth" className="hover:text-background transition-colors">Help Center</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Safety</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Terms of Service</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-background/20 text-center text-background/50 text-sm">
          <p>© 2024 LocalConnect. All rights reserved. Made with ❤️ for travelers.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;