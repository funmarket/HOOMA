import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const AppAdminPage = lazy(() =>
  import('./pages/AppAdminPage').then((module) => ({ default: module.AppAdminPage })),
);
const AddPlacePage = lazy(() =>
  import('./pages/AddPlacePage').then((module) => ({ default: module.AddPlacePage })),
);
const CheckInPage = lazy(() =>
  import('./pages/CheckInPage').then((module) => ({ default: module.CheckInPage })),
);
const CommunityPage = lazy(() =>
  import('./pages/CommunityPage').then((module) => ({ default: module.CommunityPage })),
);
const CreateEventPage = lazy(() =>
  import('./pages/CreateEventPage').then((module) => ({ default: module.CreateEventPage })),
);
const CreateFundPage = lazy(() =>
  import('./pages/CreateFundPage').then((module) => ({ default: module.CreateFundPage })),
);
const CreateRequestPage = lazy(() =>
  import('./pages/CreateRequestPage').then((module) => ({ default: module.CreateRequestPage })),
);
const CreateRidePage = lazy(() =>
  import('./pages/CreateRidePage').then((module) => ({ default: module.CreateRidePage })),
);
const EventChatPage = lazy(() =>
  import('./pages/EventChatPage').then((module) => ({ default: module.EventChatPage })),
);
const EventDetailPage = lazy(() =>
  import('./pages/EventDetailPage').then((module) => ({ default: module.EventDetailPage })),
);
const FormationBuilderPage = lazy(() =>
  import('./pages/FormationBuilderPage').then((module) => ({
    default: module.FormationBuilderPage,
  })),
);
const FundDetailPage = lazy(() =>
  import('./pages/FundDetailPage').then((module) => ({ default: module.FundDetailPage })),
);
const FundMePage = lazy(() =>
  import('./pages/FundMePage').then((module) => ({ default: module.FundMePage })),
);
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage })),
);
const EventsPage = lazy(() =>
  import('./pages/EventsPage').then((module) => ({ default: module.EventsPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const MembersPage = lazy(() =>
  import('./pages/MembersPage').then((module) => ({ default: module.MembersPage })),
);
const MorePage = lazy(() =>
  import('./pages/MorePage').then((module) => ({ default: module.MorePage })),
);
const NewCommunityPage = lazy(() =>
  import('./pages/NewCommunityPage').then((module) => ({ default: module.NewCommunityPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const PlayPage = lazy(() =>
  import('./pages/PlayPage').then((module) => ({ default: module.PlayPage })),
);
const PlacesPage = lazy(() =>
  import('./pages/PlacesPage').then((module) => ({ default: module.PlacesPage })),
);
const PlaceDetailPage = lazy(() =>
  import('./pages/PlaceDetailPage').then((module) => ({ default: module.PlaceDetailPage })),
);
const PitchPage = lazy(() =>
  import('./pages/PitchPage').then((module) => ({ default: module.PitchPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const PublicPlayerProfilePage = lazy(() =>
  import('./pages/PublicPlayerProfilePage').then((module) => ({
    default: module.PublicPlayerProfilePage,
  })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const RequestsPage = lazy(() =>
  import('./pages/RequestsPage').then((module) => ({ default: module.RequestsPage })),
);
const RideDetailPage = lazy(() =>
  import('./pages/RideDetailPage').then((module) => ({ default: module.RideDetailPage })),
);
const RidesPage = lazy(() =>
  import('./pages/RidesPage').then((module) => ({ default: module.RidesPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const TeamsPage = lazy(() =>
  import('./pages/TeamsPage').then((module) => ({ default: module.TeamsPage })),
);
const CreateTeamChallengePage = lazy(() =>
  import('./pages/CreateTeamChallengePage').then((module) => ({
    default: module.CreateTeamChallengePage,
  })),
);
const TeamChallengeDetailPage = lazy(() =>
  import('./pages/TeamChallengeDetailPage').then((module) => ({
    default: module.TeamChallengeDetailPage,
  })),
);
const TeamGameDetailPage = lazy(() =>
  import('./pages/TeamGameDetailPage').then((module) => ({
    default: module.TeamGameDetailPage,
  })),
);
const TeamProfilePage = lazy(() =>
  import('./pages/TeamProfilePage').then((module) => ({ default: module.TeamProfilePage })),
);
const WatchPage = lazy(() =>
  import('./pages/WatchPage').then((module) => ({ default: module.WatchPage })),
);

function RouteLoading() {
  return (
    <div className="page-shell">
      <div className="surface-card p-6 text-sm muted" role="status" aria-live="polite">
        Loading…
      </div>
    </div>
  );
}

function routeElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={routeElement(<LoginPage />)} />
        <Route path="/register" element={routeElement(<RegisterPage />)} />
        <Route element={<Layout />}>
          <Route path="/" element={routeElement(<HomePage />)} />
          <Route path="/telegram" element={routeElement(<HomePage />)} />
          <Route path="/events" element={routeElement(<EventsPage />)} />
          <Route path="/play" element={routeElement(<PlayPage />)} />
          <Route path="/places" element={routeElement(<PlacesPage />)} />
          <Route path="/places/new" element={routeElement(<AddPlacePage />)} />
          <Route path="/places/:placeId" element={routeElement(<PlaceDetailPage />)} />
          <Route path="/pitch" element={routeElement(<PitchPage />)} />
          <Route path="/watch" element={routeElement(<WatchPage />)} />
          <Route path="/watch/places" element={routeElement(<PlacesPage />)} />
          <Route path="/watch/places/new" element={routeElement(<AddPlacePage />)} />
          <Route path="/watch/places/:placeId" element={routeElement(<PlaceDetailPage />)} />
          <Route path="/community" element={routeElement(<CommunityPage />)} />
          <Route path="/teams" element={routeElement(<TeamsPage />)} />
          <Route path="/teams/:teamId" element={routeElement(<TeamProfilePage />)} />
          <Route
            path="/teams/:teamId/challenge"
            element={routeElement(<CreateTeamChallengePage />)}
          />
          <Route
            path="/teams/challenges/:challengeId"
            element={routeElement(<TeamChallengeDetailPage />)}
          />
          <Route path="/teams/games/:gameId" element={routeElement(<TeamGameDetailPage />)} />
          <Route path="/more" element={routeElement(<MorePage />)} />
          <Route path="/requests" element={routeElement(<RequestsPage />)} />
          <Route path="/requests/new" element={routeElement(<CreateRequestPage />)} />
          <Route path="/rides" element={routeElement(<RidesPage />)} />
          <Route path="/rides/new" element={routeElement(<CreateRidePage />)} />
          <Route path="/rides/:rideId" element={routeElement(<RideDetailPage />)} />
          <Route path="/fundme" element={routeElement(<FundMePage />)} />
          <Route path="/fundme/new" element={routeElement(<CreateFundPage />)} />
          <Route path="/fundme/:fundId" element={routeElement(<FundDetailPage />)} />
          <Route path="/events/new" element={routeElement(<CreateEventPage />)} />
          <Route path="/events/:eventId" element={routeElement(<EventDetailPage />)} />
          <Route
            path="/events/:eventId/formation"
            element={routeElement(<FormationBuilderPage />)}
          />
          <Route path="/events/:eventId/chat" element={routeElement(<EventChatPage />)} />
          <Route path="/events/:eventId/check-in" element={routeElement(<CheckInPage />)} />
          <Route path="/community/new" element={routeElement(<NewCommunityPage />)} />
          <Route path="/community/members" element={routeElement(<MembersPage />)} />
          <Route path="/admin" element={routeElement(<AdminPage />)} />
          <Route path="/app-admin" element={routeElement(<AppAdminPage />)} />
          <Route path="/profile/:userId" element={routeElement(<PublicPlayerProfilePage />)} />
          <Route path="/profile" element={routeElement(<ProfilePage />)} />
          <Route path="/settings" element={routeElement(<SettingsPage />)} />
          <Route path="*" element={routeElement(<NotFoundPage />)} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
