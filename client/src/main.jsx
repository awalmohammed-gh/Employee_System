import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ManagementContextProvider } from './context/ManagementContextProvider.jsx'
import { ThemeContextProvider } from './context/ThemeContext.jsx'
import { AttendanceProvider } from './context/AttendanceContext.jsx'
import { BrandingProvider } from './context/BrandingContext.jsx'

createRoot(document.getElementById("root")).render(
  <ThemeContextProvider>
    <BrandingProvider>
      <AuthProvider>
        <ManagementContextProvider>
          <AttendanceProvider>
            <App />
          </AttendanceProvider>
        </ManagementContextProvider>
      </AuthProvider>
    </BrandingProvider>
  </ThemeContextProvider>,
);

