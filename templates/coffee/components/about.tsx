import { Coffee, Leaf, Heart } from "lucide-react"

const features = [
  {
    icon: Coffee,
    title: "Single Origin",
    description: "We source our beans directly from small farms across Ethiopia, Colombia, and Guatemala.",
  },
  {
    icon: Leaf,
    title: "Sustainably Sourced",
    description: "Every bean is ethically traded, supporting farming communities and the environment.",
  },
  {
    icon: Heart,
    title: "Roasted With Love",
    description: "Small-batch roasting ensures each cup carries the unique character of its origin.",
  },
]

export function About() {
  return (
    <section id="about" className="py-24 md:py-32 bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">Our Story</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold leading-tight text-foreground mb-6 text-balance">
              Crafted with passion since 2015
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              What started as a small roastery in Brooklyn has grown into a beloved neighborhood café. We believe great
              coffee is more than a drink — it&apos;s a ritual, a moment of pause, a connection to the hands that
              cultivated each bean.
            </p>
            <div className="grid sm:grid-cols-3 gap-8">
              {features.map((feature) => (
                <div key={feature.title}>
                  <feature.icon className="h-8 w-8 text-accent mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden">
              <img src="/barista-pouring-coffee-artistic-shot-warm-tones.jpg" alt="Barista at work" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-accent/10 rounded-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
