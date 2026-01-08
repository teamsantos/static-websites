import { MapPin, Clock, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Contact() {
  return (
    <section id="contact" className="py-24 md:py-32 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <p className="text-sm font-medium tracking-widest uppercase opacity-70 mb-4">Come Say Hello</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-8 text-balance">
              Visit Our Café
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="h-6 w-6 mt-1 opacity-70" />
                <div>
                  <h3 className="font-semibold mb-1">Location</h3>
                  <p className="opacity-80">
                    245 Bedford Avenue
                    <br />
                    Brooklyn, NY 11211
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 mt-1 opacity-70" />
                <div>
                  <h3 className="font-semibold mb-1">Hours</h3>
                  <p className="opacity-80">
                    Mon – Fri: 7am – 7pm
                    <br />
                    Sat – Sun: 8am – 6pm
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="h-6 w-6 mt-1 opacity-70" />
                <div>
                  <h3 className="font-semibold mb-1">Contact</h3>
                  <p className="opacity-80">
                    (718) 555-0123
                    <br />
                    hello@brewstone.coffee
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary-foreground/10 rounded-2xl p-8">
            <h3 className="font-serif text-2xl font-semibold mb-2">Stay in the Loop</h3>
            <p className="opacity-80 mb-6">
              Subscribe for exclusive offers, new roast announcements, and brewing tips.
            </p>
            <form className="space-y-4">
              <Input
                type="email"
                placeholder="Your email address"
                className="bg-primary-foreground/10 border-primary-foreground/20 placeholder:text-primary-foreground/50 text-primary-foreground"
              />
              <Button className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
