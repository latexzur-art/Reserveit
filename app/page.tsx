import Header from "@/components/landing/Header"
import Hero from "@/components/landing/Hero"
import About from "@/components/landing/About"
import HowItWorks from "@/components/landing/HowItWorks"
import Facilities from "@/components/landing/Facilities"
import Equipment from "@/components/landing/Equipment"
import Contact from "@/components/landing/Contact"
import Footer from "@/components/landing/Footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Facilities />
        <Equipment />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
