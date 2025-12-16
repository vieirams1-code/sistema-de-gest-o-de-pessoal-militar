import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Users, 
  Menu, 
  X, 
  Home,
  UserPlus,
  Shield,
  ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Dashboard', page: 'Home', icon: Home },
  { name: 'Efetivo', page: 'Militares', icon: Users },
  { name: 'Punições', page: 'Punicoes', icon: Shield },
  { name: 'Medalhas', page: 'Medalhas', icon: Shield },
  { name: 'Armamentos', page: 'Armamentos', icon: Shield },
  { name: 'Atestados', page: 'Atestados', icon: Shield },
  { name: 'Agenda JISO', page: 'AgendarJISO', icon: Calendar },
  { name: 'Férias', page: 'Ferias', icon: Menu },
  { name: 'Livro', page: 'CadastrarRegistroLivro', icon: UserPlus },
  { name: 'Publicação Ex Officio', page: 'CadastrarPublicacao', icon: UserPlus },
  { name: 'Publicações', page: 'Publicacoes', icon: Shield },
  { name: 'Configurações', page: 'Configuracoes', icon: Menu },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#1e3a5f] text-white z-40 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <span className="font-bold text-lg">SGP Militar</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:bg-white/10"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#1e3a5f] text-white z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <span className="font-bold text-lg block">SGP Militar</span>
              <span className="text-xs text-white/60">Sistema de Gestão</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-xs text-white/60 text-center">
              Sistema de Gerenciamento de Pessoal
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}