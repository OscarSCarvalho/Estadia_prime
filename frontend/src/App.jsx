import { Routes, Route } from 'react-router';
import Layout from './components/Layout.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Inicio from './pages/Inicio.jsx';
import Entrar from './pages/Entrar.jsx';
import Cadastro from './pages/Cadastro.jsx';
import MinhaConta from './pages/MinhaConta.jsx';
import AnunciarImovel from './pages/AnunciarImovel.jsx';
import Explorar from './pages/Explorar.jsx';
import ImovelDetalhe from './pages/ImovelDetalhe.jsx';
import Carrinho from './pages/Carrinho.jsx';
import MeusImoveis from './pages/painel/MeusImoveis.jsx';
import NovoImovel from './pages/painel/NovoImovel.jsx';
import EditarImovel from './pages/painel/EditarImovel.jsx';
import MeusServicos from './pages/painel/MeusServicos.jsx';
import MinhasReservas from './pages/reservas/MinhasReservas.jsx';
import ReservasRecebidas from './pages/reservas/ReservasRecebidas.jsx';
import Agenda from './pages/reservas/Agenda.jsx';
import Pagamento from './pages/reservas/Pagamento.jsx';
import NaoEncontrada from './pages/NaoEncontrada.jsx';

// Visitante navega livremente (imóveis, fotos, serviços). O login só é pedido
// ao reservar ou anunciar: <RotaProtegida> leva para a tela de destaque /entrar
export default function App() {
  return (
    <Routes>
      <Route path="entrar" element={<Entrar />} />

      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="explorar" element={<Explorar />} />
        <Route path="imoveis/:id" element={<ImovelDetalhe />} />
        <Route
          path="imoveis/:id/carrinho"
          element={
            <RotaProtegida>
              <Carrinho />
            </RotaProtegida>
          }
        />
        <Route path="cadastro" element={<Cadastro />} />
        <Route
          path="anunciar"
          element={
            <RotaProtegida>
              <AnunciarImovel />
            </RotaProtegida>
          }
        />
        <Route
          path="minha-conta"
          element={
            <RotaProtegida>
              <MinhaConta />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/imoveis"
          element={
            <RotaProtegida perfil="anfitriao">
              <MeusImoveis />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/imoveis/novo"
          element={
            <RotaProtegida perfil="anfitriao">
              <NovoImovel />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/imoveis/:id"
          element={
            <RotaProtegida perfil="anfitriao">
              <EditarImovel />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/servicos"
          element={
            <RotaProtegida perfil="prestador">
              <MeusServicos />
            </RotaProtegida>
          }
        />
        <Route
          path="minhas-reservas"
          element={
            <RotaProtegida perfil="hospede">
              <MinhasReservas />
            </RotaProtegida>
          }
        />
        <Route
          path="reservas/:id/pagamento"
          element={
            <RotaProtegida perfil="hospede">
              <Pagamento />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/reservas"
          element={
            <RotaProtegida perfil="anfitriao">
              <ReservasRecebidas />
            </RotaProtegida>
          }
        />
        <Route
          path="painel/agenda"
          element={
            <RotaProtegida perfil="prestador">
              <Agenda />
            </RotaProtegida>
          }
        />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
