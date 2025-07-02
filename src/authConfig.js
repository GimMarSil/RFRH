

    import { LogLevel } from "@azure/msal-browser";

    /**
     * Configuração para msal-browser.
     * Visite https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
     * para saber mais sobre as opções de configuração.
     */
    export const msalConfig = {
        auth: {
            clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "2d448115-1dbc-4b58-829a-f93fd908ed2a", // O Client ID da sua app Azure AD
            authority: process.env.NEXT_PUBLIC_AZURE_AUTHORITY || "https://login.microsoftonline.com/3e0e31b7-7b38-4f10-b5a8-ad53b3dc25f", // O Authority da sua app Azure AD (incluindo o Tenant ID)
            redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/perfil", // Deve corresponder ao configurado no Azure
            postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_LOGOUT_REDIRECT_URI || "http://localhost:3000/"
        },
        cache: {
            cacheLocation: "sessionStorage", // Ou 'localStorage' se preferir
            storeAuthStateInCookie: false,
        },
        system: {
            loggerOptions: {
                loggerCallback: (level, message, containsPii) => {
                    if (containsPii) {
                        return;
                    }
                    switch (level) {
                        case LogLevel.Error:
                            console.error(message);
                            return;
                        case LogLevel.Info:
                            // console.info(message); // Descomente para logs detalhados
                            return;
                        case LogLevel.Verbose:
                            // console.debug(message); // Descomente para logs muito detalhados
                            return;
                        case LogLevel.Warning:
                            console.warn(message);
                            return;
                        default:
                            return;
                    }
                }
            }
        }
    };

    /**
     * Escopos que sua aplicação precisa para acessar a API do Microsoft Graph.
     * Para mais informações sobre escopos, visite:
     * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
     */
    export const loginRequest = {
        scopes: ["User.Read"] // Escopo básico para ler o perfil do usuário
    };

    /**
     * Adicione aqui escopos para o Microsoft Graph se precisar acessar outros dados.
     * Exemplo: { scopes: ["User.Read", "Mail.Read"] }
     */
    export const graphConfig = {
        graphMeEndpoint: "https://graph.microsoft.com/v1.0/me" // Endpoint para obter dados do usuário
    };
    ```javascript
    // 2. Configuração do App com MsalProvider
    // Salve como: pages/_app.js

    import { MsalProvider } from "@azure/msal-react";
    import { PublicClientApplication } from "@azure/msal-browser";
    import { msalConfig } from "../authConfig"; // Ajuste o caminho se necessário
    import "../styles/globals.css"; // Importando Tailwind CSS
    import Layout from '../components/Layout';

    const msalInstance = new PublicClientApplication(msalConfig);

    function MyApp({ Component, pageProps }) {
        return (
            <MsalProvider instance={msalInstance}>
                <Layout>
                    <Component {...pageProps} />
                </Layout>
            </MsalProvider>
        );
    }

    export default MyApp;
    ```javascript
    // 3. Componente de Layout (opcional, mas bom para navegação)
    // Crie a pasta 'components' e salve como: components/Layout.js

    import React from "react";
    import { useIsAuthenticated, useMsal } from "@azure/msal-react";
    import { loginRequest } from "../authConfig"; // Ajuste o caminho

    const SignInButton = () => {
        const { instance } = useMsal();

        const handleLogin = () => {
            instance.loginRedirect(loginRequest).catch(e => {
                console.error("Falha no login por redirecionamento:", e);
            });
        }
        return <button onClick={handleLogin} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Entrar com Office 365</button>;
    };

    const SignOutButton = () => {
        const { instance } = useMsal();

        const handleLogout = () => {
            instance.logoutRedirect({
                postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_LOGOUT_REDIRECT_URI || "http://localhost:3000/",
            });
        }
        return <button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Sair</button>;
    };

    export default function Layout({ children }) {
        const isAuthenticated = useIsAuthenticated();

        return (
            <div className="min-h-screen bg-gray-100 flex flex-col">
                <nav className="bg-white shadow-md">
                    <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                        <a href="/" className="text-xl font-semibold text-gray-700">App Multi-Serviço</a>
                        <div>
                            {isAuthenticated ? <SignOutButton /> : <SignInButton />}
                        </div>
                    </div>
                </nav>
                <main className="flex-grow container mx-auto px-6 py-8">
                    {children}
                </main>
                <footer className="bg-gray-800 text-white text-center p-4">
                    © {new Date().getFullYear()} Minha Empresa
                </footer>
            </div>
        );
    }
    ```javascript
    // 4. Página Inicial / Login
    // Salve como: pages/index.js

    import { useIsAuthenticated, useMsal } from "@azure/msal-react";
    import Head from 'next/head';

    export default function Home() {
        const isAuthenticated = useIsAuthenticated();
        const { accounts } = useMsal();

        return (
            <div className="flex flex-col items-center justify-center py-10">
                <Head>
                    <title>Página de Login</title>
                </Head>
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Bem-vindo!</h1>
                {isAuthenticated ? (
                    <div>
                        <p className="text-lg text-gray-700 mb-4">Você está autenticado como: {accounts[0]?.name || accounts[0]?.username}</p>
                        <p className="text-lg text-gray-700">
                            Acesse seu <a href="/perfil" className="text-blue-600 hover:underline">perfil</a> para ver mais detalhes.
                        </p>
                    </div>
                ) : (
                    <p className="text-lg text-gray-700">Por favor, faça login para continuar.</p>
                )}
            </div>
        );
    }
    ```javascript
    // 5. Página de Perfil do Usuário
    // Salve como: pages/perfil.js

    import { useEffect, useState } from "react";
    import { useMsal, useIsAuthenticated, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
    import { loginRequest } from "../authConfig"; // Ajuste o caminho
    import Head from 'next/head';

    export default function PerfilPage() {
        const { instance, accounts } = useMsal();
        const isAuthenticated = useIsAuthenticated();
        const [userData, setUserData] = useState(null);
        const [employeeData, setEmployeeData] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);

        useEffect(() => {
            if (isAuthenticated && accounts.length > 0) {
                const currentUser = accounts[0];
                setUserData({
                    nome: currentUser.name,
                    email: currentUser.username, // Geralmente o UPN/email
                    idAzure: currentUser.localAccountId, // ID local da conta no token
                    objectId: currentUser.idTokenClaims?.oid, // Object ID do Azure AD
                    tenantId: currentUser.tenantId,
                });

                // O campo que você usará para buscar no SQL.
                // Assumindo que o 'username' (email/UPN) do Azure AD é o que está na coluna [UserId] do SQL.
                // Se for outro campo (ex: objectId), ajuste aqui.
                const userIdForSqlSearch = currentUser.username;

                if (userIdForSqlSearch) {
                    setLoading(true);
                    fetch(`/api/employee?userId=${encodeURIComponent(userIdForSqlSearch)}`)
                        .then(res => {
                            if (!res.ok) {
                                return res.json().then(err => { throw new Error(err.message || `Erro HTTP ${res.status}`) });
                            }
                            return res.json();
                        })
                        .then(data => {
                            setEmployeeData(data);
                            setError(null);
                        })
                        .catch(err => {
                            console.error("Erro ao buscar dados do funcionário:", err);
                            setError(`Falha ao buscar dados do funcionário: ${err.message}`);
                            setEmployeeData(null);
                        })
                        .finally(() => setLoading(false));
                }
            }
        }, [isAuthenticated, accounts, instance]);

        const handleLoginRedirect = () => {
            instance.loginRedirect(loginRequest).catch(e => console.error(e));
        };

        return (
            <div className="container mx-auto px-4 py-8">
                <Head>
                    <title>Perfil do Usuário</title>
                </Head>
                <AuthenticatedTemplate>
                    {userData && (
                        <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
                            <h1 className="text-2xl font-semibold text-gray-800 mb-4">Perfil do Usuário (Azure AD)</h1>
                            <p className="text-gray-700"><strong className="font-medium">Nome:</strong> {userData.nome}</p>
                            <p className="text-gray-700"><strong className="font-medium">Email/User ID (Azure):</strong> {userData.email}</p>
                            <p className="text-gray-700"><strong className="font-medium">Object ID (Azure):</strong> {userData.objectId}</p>
                            <p className="text-gray-700"><strong className="font-medium">Tenant ID (Azure):</strong> {userData.tenantId}</p>
                        </div>
                    )}

                    {loading && <p className="text-lg text-blue-600">Carregando dados do funcionário do SQL Server...</p>}
                    {error && <p className="text-lg text-red-600 bg-red-100 p-3 rounded-md">Erro: {error}</p>}

                    {employeeData && employeeData.length > 0 && (
                        <div className="bg-white shadow-xl rounded-lg p-6">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Informações do Funcionário (SQL Server)</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {Object.keys(employeeData[0]).map(key => (
                                                <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {employeeData.map((row, index) => (
                                            <tr key={index}>
                                                {Object.values(row).map((value, i) => (
                                                    <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value instanceof Date ? value.toLocaleDateString() : String(value))}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {employeeData && employeeData.length === 0 && !loading && (
                         <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">Aviso</p>
                            <p>Nenhum funcionário encontrado no SQL Server com o UserID: {userData?.email}.</p>
                        </div>
                    )}
                </AuthenticatedTemplate>

                <UnauthenticatedTemplate>
                    <div className="text-center">
                        <h1 className="text-xl font-semibold text-gray-700 mb-4">Acesso Negado</h1>
                        <p className="text-gray-600 mb-6">Por favor, faça login para ver esta página.</p>
                        <button
                            onClick={handleLoginRedirect}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Fazer Login
                        </button>
                    </div>
                </UnauthenticatedTemplate>
            </div>
        );
    }
    ```javascript
    // 6. API Route para buscar dados do SQL Server
    // Crie a pasta 'api' dentro de 'pages' se não existir.
    // Salve como: pages/api/employee.js

    import sql from 'mssql';

    // Configuração da conexão com o SQL Server
    // É ALTAMENTE RECOMENDADO usar variáveis de ambiente para dados sensíveis.
    const sqlConfig = {
        user: process.env.SQL_USER || "phcqry",
        password: process.env.SQL_PASSWORD || "dsiManager2019!",
        server: process.env.SQL_SERVER || "SRVSQL",
        database: process.env.SQL_DATABASE || "RFWebApp",
        options: {
            encrypt: true, // Para Azure SQL ou se o seu SQL Server estiver configurado para exigir criptografia
            trustServerCertificate: true // Mude para false em produção se tiver um certificado válido
        }
    };

    export default async function handler(req, res) {
        if (req.method !== 'GET') {
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ message: `Método ${req.method} não permitido.` });
        }

        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: "Parâmetro 'userId' é obrigatório." });
        }

        try {
            // Conectar ao banco de dados
            await sql.connect(sqlConfig);

            // Criar a query parametrizada para evitar SQL Injection
            const queryString = `
                SELECT [Number]
                      ,[Email]
                      ,[Name]
                      ,[Active]
                      ,[CompanyName]
                      ,[UserId]
                      ,[Department]
                      ,[AdmissionDate]
                      ,[SyncStatus]
                      ,[Current]
                      ,[TerminationDate]
                      ,[CreatedAt]
                      ,[CreatedBy]
                      ,[UpdatedAt]
                      ,[UpdatedBy]
                      ,[IdentityCard]
                      ,[LastSync]
                      ,[PassportNumber]
                      ,[SalaryRule]
                      ,[ScheduleId]
                  FROM [RFWebApp].[dbo].[Employee]
                  WHERE [UserId] = @userIdParameter;
            `;

            const request = new sql.Request();
            request.input('userIdParameter', sql.NVarChar, userId); // Ajuste o tipo sql.NVarChar se o seu UserId for diferente

            const result = await request.query(queryString);

            if (result.recordset.length > 0) {
                res.status(200).json(result.recordset);
            } else {
                res.status(200).json([]); // Retorna array vazio se não encontrar, para o frontend tratar
            }

        } catch (error) {
            console.error("Erro na API SQL:", error);
            // Verifique se error.originalError existe para mais detalhes do driver SQL
            const errorMessage = error.originalError ? error.originalError.message : error.message;
            res.status(500).json({ message: "Erro ao conectar ou consultar o banco de dados.", error: errorMessage });
        } finally {
            // Fechar a conexão é importante, mas o pool de conexões do mssql lida com isso de forma eficiente.
            // Se não estiver usando pooling, sql.close() seria chamado aqui.
            // Com o pooling padrão, não é necessário fechar explicitamente após cada query.
            // sql.close(); // Descomente se não estiver usando o pool de conexões padrão ou se encontrar problemas.
        }
    }
    ```text
    // 7. Arquivo de variáveis de ambiente
    // Crie este arquivo na raiz do seu projeto
    // Salve como: .env.local

    NEXT_PUBLIC_AZURE_CLIENT_ID="2d448115-1dbc-4b58-829a-f93fd908ed2a"
    NEXT_PUBLIC_AZURE_AUTHORITY="https://login.microsoftonline.com/3e0e31b7-7b38-4f10-b5a8-ad53b3dc25f"
    NEXT_PUBLIC_REDIRECT_URI="http://localhost:3000/perfil"
    NEXT_PUBLIC_AZURE_LOGOUT_REDIRECT_URI="http://localhost:3000/"

    # Credenciais do SQL Server (NÃO prefixe com NEXT_PUBLIC_ para mantê-las no servidor)
    SQL_USER="phcqry"
    SQL_PASSWORD="dsiManager2019!"
    SQL_SERVER="SRVSQL"
    SQL_DATABASE="RFWebApp"

    # Opcional: Se o seu SQL Server requer SSL mas não tem um certificado confiável (apenas para desenvolvimento)
    # NODE_TLS_REJECT_UNAUTHORIZED=0
    