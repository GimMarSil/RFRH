import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "../config/authConfig";
import '../styles/globals.css';
import { FuncionarioProvider } from "../context/FuncionarioContext";
import { SelectedEmployeeProvider } from "@/contexts/SelectedEmployeeContext";
import type { AppProps } from 'next/app';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

const msalInstance = new PublicClientApplication(msalConfig);

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <MsalProvider instance={msalInstance}>
      <SelectedEmployeeProvider>
        <FuncionarioProvider>
          <Component {...pageProps} />
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </FuncionarioProvider>
      </SelectedEmployeeProvider>
    </MsalProvider>
  );
}

export default MyApp; 