import "./LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-page">
      {/* Animated background elements */}
      <div className="bg-animation">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
      </div>

      <main className="container">
        <h1 className="app-name animate-fade-in">UWay</h1>

        <p className="value-prop animate-fade-in-delay-1">
          Find the shortest path between your classes.
        </p>

        <a href="/auth" className="cta-button animate-fade-in-delay-2">
          Get Started →
        </a>

        <div className="steps animate-fade-in-delay-3">
          <div className="step">
            <span className="step-number">1</span>
            <p>Upload your schedule</p>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <p>View your routes</p>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <p>Never be late</p>
          </div>
        </div>

        <footer className="footer animate-fade-in-delay-4">
          <a href="#privacy">Privacy</a>
          <span className="separator">•</span>
          <a href="#help">Help</a>
        </footer>
      </main>
    </div>
  );
}

export default LandingPage;
