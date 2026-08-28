import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Download, FileText, Github, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2"><FileText className="h-6 w-6" /><span className="text-xl font-bold">Sendmybill</span></Link>
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main navigation">
          <a className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline" href="#how-it-works">How it works</a>
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Create an invoice</Link></Button>
        </nav>
      </div>
    </header>

    <main>
      <section className="container mx-auto grid items-center gap-12 px-5 py-20 lg:grid-cols-[1fr_.9fr] lg:py-28">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">For freelancers, consultants, and small teams</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Professional invoices, ready before your coffee gets cold.</h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">Create, organize, and export client invoices from one focused workspace. No accounting maze—just a dependable billing workflow.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link to="/auth">Create your first invoice <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#product-preview">See the product</a></Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {['Free to get started', 'Three invoice templates', 'PDF export included'].map((benefit) => <span key={benefit} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{benefit}</span>)}
          </div>
        </div>

        <div id="product-preview" className="border bg-card p-3 shadow-lg">
          <img src="/og-preview-image.png" alt="Sendmybill invoice workspace product preview" className="aspect-[16/10] w-full object-cover object-top" />
          <div className="grid grid-cols-3 border-t">
            <PreviewStat label="Templates" value="3" />
            <PreviewStat label="Currencies" value="20" />
            <PreviewStat label="Export" value="PDF" />
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40">
        <div className="container mx-auto grid gap-8 px-5 py-16 md:grid-cols-3">
          <Feature icon={<FileText />} title="Create quickly">Reuse saved clients, add line items, calculate tax, and preview the finished invoice as you type.</Feature>
          <Feature icon={<Palette />} title="Look professional">Choose a template and add your company logo, signature, contact details, and payment information.</Feature>
          <Feature icon={<Download />} title="Keep control">Save drafts, update their status, return later, and export a clean PDF whenever you need it.</Feature>
        </div>
      </section>

      <section id="how-it-works" className="container mx-auto px-5 py-20">
        <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">A focused workflow</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">From blank page to billable in three steps</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Step number="01" title="Set your defaults">Add your identity, billing mode, currency, payment terms, and invoice numbering once.</Step>
          <Step number="02" title="Build the invoice">Select a saved client, describe the work, and let Sendmybill calculate the totals.</Step>
          <Step number="03" title="Save and export">Keep the invoice in your workspace, update its status, and download a professional PDF.</Step>
        </div>
      </section>

      <section className="container mx-auto px-5 pb-20">
        <div className="border bg-primary p-10 text-primary-foreground sm:p-14">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]"><div><h2 className="text-3xl font-bold">Your next invoice can be ready in minutes.</h2><p className="mt-3 max-w-2xl opacity-80">Set up a reusable billing workspace and spend less time formatting documents.</p></div><Button asChild size="lg" variant="secondary"><Link to="/auth">Start now <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
        </div>
      </section>
    </main>

    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Sendmybill.</p>
        <div className="flex items-center gap-4"><span className="flex items-center gap-2"><Users className="h-4 w-4" />Built for independent businesses</span><a aria-label="Sendmybill on GitHub" href="https://github.com/ANI-MAZING/invoice-swift" target="_blank" rel="noreferrer"><Github className="h-5 w-5" /></a></div>
      </div>
    </footer>
  </div>
);

const PreviewStat = ({ label, value }: { label: string; value: string }) => <div className="p-3 text-center"><p className="text-lg font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
const Feature = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => <article><div className="mb-4 flex h-11 w-11 items-center justify-center border bg-background [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 leading-relaxed text-muted-foreground">{children}</p></article>;
const Step = ({ number, title, children }: { number: string; title: string; children: ReactNode }) => <article className="border p-6"><span className="font-mono text-sm text-muted-foreground">{number}</span><h3 className="mt-6 text-xl font-semibold">{title}</h3><p className="mt-2 text-muted-foreground">{children}</p></article>;

export default Index;
import type { ReactNode } from "react";
