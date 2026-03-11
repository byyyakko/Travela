import { MapPin, Mail } from "lucide-react";

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
                Travela
              </span>
            </a>
            <p className="text-background/70 text-sm">
              Connecting travelers with passionate locals for authentic experiences worldwide.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold mb-4">Explore</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li><a href="/auth" className="hover:text-background transition-colors">Browse Locals</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Experiences</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Become a Guide</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li>
                <a href="/contact" className="hover:text-background transition-colors">
                  Get in Touch
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/travelayourway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-background transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  @travelayourway
                </a>
              </li>
              <li>
                <a
                  href="mailto:travelatheworld1123@gmail.com"
                  className="hover:text-background transition-colors flex items-center gap-1"
                >
                  <Mail className="w-3 h-3" />
                  Email Us
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li><a href="/auth" className="hover:text-background transition-colors">Terms of Service</a></li>
              <li><a href="/auth" className="hover:text-background transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-background/20 text-center text-background/50 text-sm">
          <p>© 2026 Travela. All rights reserved. Made with ❤️ for travelers.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
