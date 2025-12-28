import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Zap, Shield, TrendingUp, Github, X, Twitter } from "lucide-react";

const Index = () => {

  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen  bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="md:text-xl font-bold text-foreground">Sendmybill</span>
          </div>
          <div className="flex items-center gap-4">
            <h2 className="text-sm uppercase border p-2 md:px-3 md:py-2">Support here</h2>
            <Link to="https://github.com/ANI-MAZING"><Github/></Link>
            <Link to="https://x.com/Anirudhgharat"><Twitter/></Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-5  py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-6xl font-bold text-foreground mb-6">
            Create Professional Invoices in Seconds
          </h1>
          <p className=" md:text-xl text-lg text-muted-foreground mb-8">
            Generate beautiful, customizable invoices with our modern templates. 
            Track payments, manage clients, and get paid faster.
          </p>
          <div className="flex md:flex-row w-fit mx-auto flex-col items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8">
                Sign In
              </Button>
            </Link to="/auth">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Create new account
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground">
              Create invoices in seconds with our intuitive form builder and pre-designed templates.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your data is encrypted and secure. We never share your information with third parties.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
              <TrendingUp className="h-6  w-6" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Professional Results</h3>
            <p className="text-muted-foreground">
              Beautiful, professional invoices that make a great impression on your clients.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-primary text-primary-foreground  rounded-2xl p-12 text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className=" md:text-lg mb-8 opacity-90">
            Escape the traditional ways, choose Sendmybill to pass your bills quickly.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg ">
              Create Your First Invoice
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; {year} Sendmybill. All rights reserved. Developed by <Link className="text-white" to="https://www.aniruddha.space">Aniruddha</Link></p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
