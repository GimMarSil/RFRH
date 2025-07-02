import { createContext, useContext, useState } from "react";

const FuncionarioContext = createContext();

export function FuncionarioProvider({ children }) {
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
  return (
    <FuncionarioContext.Provider value={{ funcionarioSelecionado, setFuncionarioSelecionado }}>
      {children}
    </FuncionarioContext.Provider>
  );
}

export function useFuncionario() {
  return useContext(FuncionarioContext);
} 