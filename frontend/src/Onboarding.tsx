import { useEffect, useState, type FC, type FormEvent } from "react";
import step1Img from "./assets/Onboarding 1.png";
import step2Img from "./assets/Onboarding two.png";
import { useNavigate } from "react-router-dom";
import "./Onboarding.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5001/api";

type OnboardingProps = {
  onSubmitICal?: (url: string) => void; // optional callback for when they hit Continue
};

const Onboarding: FC<OnboardingProps> = ({ onSubmitICal }) => {
  const [icalUrl, setIcalUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const scheduleCacheKey = "uwayScheduleText";

  useEffect(() => {
    document.body.classList.add("onboarding-theme");
    return () => {
      document.body.classList.remove("onboarding-theme");
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!icalUrl.trim()) {
      setError("Please paste your schedule text first.");
      return;
    }

    setError("");
    setStatus("");
    setSubmitting(true);

    try {
      if (onSubmitICal) {
        onSubmitICal(icalUrl.trim());
      }

      try {
        localStorage.setItem(scheduleCacheKey, icalUrl.trim());
      } catch {
        /* ignore cache errors */
      }

      const response = await fetch(`${API_BASE}/schedule/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: icalUrl.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to import schedule");
      }

      setStatus("Schedule imported — loading your map.");
      navigate("/map");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      {/* Animated background elements */}
      <div className="bg-animation">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
        <div className="shape shape-4" />
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
      </div>

      <main className="onboarding-container">
        <header className="animate-fade-in">
          <h1 className="onboarding-title">Connect your Portal calendar</h1>
          <p className="onboarding-subtitle">
            Just three quick steps and UWay will start mapping routes between
            all your classes.
          </p>
        </header>

        <section className="onboarding-grid animate-fade-in-delay-2">
          {/* Step 1 */}
          <article className="onboarding-step-card">
            <div className="step-badge">1</div>
            <h2 className="step-title">Login to Quest and click "Class Schedule"</h2>
            <div className="step-illustration">
              <img
                className="step-illustration-img"
                src={step1Img}
                alt="Quest Class Schedule page"
              />
            </div>
          </article>

          {/* Step 2 */}
          <article className="onboarding-step-card">
            <div className="step-badge">2</div>
            <h2 className="step-title">Pick your term then select all (Ctrl+A) and copy (Ctrl+C)</h2>
            <div className="step-illustration">
              <img
                className="step-illustration-img"
                src={step2Img}
                alt="Quest term selection and schedule"
              />
            </div>
          </article>

          {/* Step 3 */}
          <article className="onboarding-step-card onboarding-step-3">
            <div className="step-badge">3</div>
            <h2 className="step-title">Paste into the box below</h2>

            <form className="ical-form" onSubmit={handleSubmit}>
              <label className="ical-label" htmlFor="ical-url">
                Class schedule
              </label>
              <textarea
                id="ical-url"
                className="ical-input"
                placeholder="Paste your copied schedule text here"
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                rows={6}
              />
              {error && <p className="error-text">{error}</p>}
              {status && <p className="success-text">{status}</p>}

              <button type="submit" className="cta-button cta-button-small">
                {submitting ? "Importing..." : "Continue"}
              </button>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
};

export default Onboarding;
