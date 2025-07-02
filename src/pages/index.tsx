import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Home() {
  const isAuthenticated = useIsAuthenticated();
  const { accounts, instance, inProgress } = useMsal();
  const containerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && inProgress === 'none') {
      router.push('/landing');
    }
  }, [isAuthenticated, router, inProgress]);

  useEffect(() => {
    if (containerRef.current && !isAuthenticated && inProgress === 'none') {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );
    }
  }, [isAuthenticated, inProgress]);

  const handleLogin = () => {
    if (inProgress === 'none') {
      instance.loginRedirect({
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/landing"
      });
    }
  };

  if (inProgress !== 'none') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-700">A processar autenticação...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-700">A redirecionar para a aplicação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div ref={containerRef} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Bem-vindo ao Portal RH</h1>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          Iniciar sessão com Microsoft 365
        </button>

        {isAuthenticated && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-100 border border-gray-200 rounded-lg shadow">
              <h5 className="mb-2 text-xl font-bold tracking-tight text-gray-700">Recrutamento</h5>
              <p className="font-normal text-gray-600">Gerenciar processos de recrutamento.</p>
            </div>

            <Link href="/evaluation/matrices" legacyBehavior>
              <a className="block p-6 bg-blue-50 border border-blue-200 rounded-lg shadow hover:bg-blue-100">
                <h5 className="mb-2 text-xl font-bold tracking-tight text-blue-700">Avaliação de Desempenho</h5>
                <p className="font-normal text-gray-600">Gerenciar matrizes, F-RH-04 e avaliações.</p>
              </a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 