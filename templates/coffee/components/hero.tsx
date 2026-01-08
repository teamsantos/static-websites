import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20">
      <div className="absolute inset-0 z-0">
        <img
          src="/warm-cozy-coffee-shop-interior-with-natural-light-.jpg"
          alt="Brewstone Coffee interior"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-background" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
        <div className="max-w-4xl">
          <p className="text-sm font-medium tracking-widest uppercase text-accent mb-6">Artisan Coffee Roasters</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight text-foreground mb-8 text-balance">
            Best Served
            <br />
            <span className="italic font-normal">Fresh</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed">
            From bean to cup, we craft each pour with intention. Experience coffee the way it was meant to be —
            thoughtfully roasted, carefully brewed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90">
              View Our Menu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 bg-transparent">
              Find Our Café
            </Button>
          </div>
        </div>

        <div className="absolute bottom-12 right-6 md:right-12 hidden lg:block">
          <div className="relative w-80 h-80">
            <img
              src="/beautiful-latte-art-in-ceramic-cup-top-view-warm-l.jpg"
              alt="Latte art"
              className="w-full h-full object-cover rounded-full shadow-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
