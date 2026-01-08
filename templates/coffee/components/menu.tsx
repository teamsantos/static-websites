import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const menuItems = [
  {
    category: "Espresso",
    items: [
      { name: "Espresso", price: "$3.50", description: "Bold, concentrated, pure" },
      { name: "Americano", price: "$4.00", description: "Espresso with hot water" },
      { name: "Cortado", price: "$4.50", description: "Espresso with equal parts steamed milk", popular: true },
      { name: "Flat White", price: "$5.00", description: "Velvety microfoam, double shot" },
    ],
  },
  {
    category: "Signature",
    items: [
      { name: "Brewstone Latte", price: "$5.50", description: "House blend with vanilla & oat milk", popular: true },
      { name: "Honey Lavender", price: "$6.00", description: "Lavender-infused espresso with local honey" },
      { name: "Cold Brew", price: "$5.00", description: "24-hour steeped, smooth & bold" },
      { name: "Matcha Latte", price: "$5.50", description: "Ceremonial grade matcha, oat milk" },
    ],
  },
  {
    category: "Pastries",
    items: [
      { name: "Almond Croissant", price: "$4.50", description: "Flaky, buttery, fresh-baked" },
      { name: "Banana Bread", price: "$4.00", description: "Walnut & chocolate chip", popular: true },
      { name: "Morning Bun", price: "$4.25", description: "Cinnamon sugar, orange zest" },
      { name: "Avocado Toast", price: "$9.00", description: "Sourdough, chili flakes, microgreens" },
    ],
  },
]

export function Menu() {
  return (
    <section id="menu" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">What We Serve</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground text-balance">Our Menu</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {menuItems.map((section) => (
            <div key={section.category}>
              <h3 className="font-serif text-2xl font-semibold text-foreground mb-6 pb-2 border-b border-border">
                {section.category}
              </h3>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <Card key={item.name} className="bg-card border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          {item.popular && (
                            <Badge variant="secondary" className="text-xs bg-accent/10 text-accent">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium text-foreground">{item.price}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
