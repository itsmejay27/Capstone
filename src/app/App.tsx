import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { ThemeModeProvider } from './context/ThemeModeContext';
import { router } from './routes';
import { ReauthProvider } from './components/ReauthProvider';

export default function App() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <ReauthProvider>
          <RouterProvider router={router} />
        </ReauthProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}
