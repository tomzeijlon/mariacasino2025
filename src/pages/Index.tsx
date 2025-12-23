import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Snowfall } from '@/components/Snowfall';
import { Gift, Users, BarChart3 } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen gradient-festive relative flex items-center justify-center">
      <Snowfall />
      
      <div className="relative z-10 container mx-auto px-4 py-16 text-center">
        {/* Hero */}
        <div className="mb-16">
          <Gift className="w-20 h-20 mx-auto text-gold animate-float mb-6" />
          <h1 className="font-display text-5xl md:text-7xl text-gradient-gold mb-6">
            🎰 Maria Casino
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Vem köpte paketet egentligen? 
            <br />
            Rösta och ta reda på det!
          </p>
        </div>

        {/* Action cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Vote card */}
          <Link to="/vote" className="group">
            <div className="p-8 rounded-2xl bg-card/80 backdrop-blur border border-border hover:border-gold/50 transition-all duration-300 hover:glow-gold">
              <Users className="w-12 h-12 mx-auto text-gold mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="font-display text-2xl mb-2">Rösta</h2>
              <p className="text-muted-foreground mb-4">
                Ge din röst på vem som borde ha paketet
              </p>
              <Button variant="vote" size="lg" className="w-full">
                Öppna röstning
              </Button>
            </div>
          </Link>

          {/* Admin card */}
          <Link to="/admin" className="group">
            <div className="p-8 rounded-2xl bg-card/80 backdrop-blur border border-border hover:border-gold/50 transition-all duration-300 hover:glow-gold">
              <BarChart3 className="w-12 h-12 mx-auto text-gold mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="font-display text-2xl mb-2">Admin</h2>
              <p className="text-muted-foreground mb-4">
                Hantera deltagare och visa resultat
              </p>
              <Button variant="festive" size="lg" className="w-full">
                Öppna admin
              </Button>
            </div>
          </Link>
        </div>

        {/* Instructions */}
        <div className="mt-16 max-w-3xl mx-auto text-left">
          <h3 className="font-display text-2xl text-gold text-center mb-8">Så funkar det</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-card/50 border border-border">
              <span className="text-3xl mb-4 block">1️⃣</span>
              <h4 className="font-display text-lg mb-2">Lägg till deltagare</h4>
              <p className="text-sm text-muted-foreground">
                I admin-vyn lägger du till alla som deltar i leken
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card/50 border border-border">
              <span className="text-3xl mb-4 block">2️⃣</span>
              <h4 className="font-display text-lg mb-2">Starta omröstning</h4>
              <p className="text-sm text-muted-foreground">
                Välj vems paket som ska röstas om och alla röstar på sina mobiler
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card/50 border border-border">
              <span className="text-3xl mb-4 block">3️⃣</span>
              <h4 className="font-display text-lg mb-2">Lås rätt svar</h4>
              <p className="text-sm text-muted-foreground">
                När ni hittat rätt person, lås in svaret och fortsätt med nästa
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
