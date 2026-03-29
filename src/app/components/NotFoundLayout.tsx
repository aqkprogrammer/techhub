import HeroSection from "./HeroSection";
import NavigationActions from "./NavigationActions";
import GamesPanel from "./GamesPanel";
import ErrorFooter from "./ErrorFooter";

export default function NotFoundLayout() {
  return (
    <div className="min-h-screen from-slate-50 via-white to-slate-100 px-6 py-20 flex flex-col items-center">
      <HeroSection />
      <NavigationActions />
      <GamesPanel />
      <ErrorFooter />
    </div>
  );
}

