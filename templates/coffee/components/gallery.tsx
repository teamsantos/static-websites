const images = [
  { src: "/espresso-machine-steam-artistic-shot.jpg", alt: "Espresso machine" },
  { src: "/coffee-beans-close-up-warm-lighting.jpg", alt: "Coffee beans" },
  { src: "/cozy-cafe-interior-plants-wooden-tables.jpg", alt: "Café interior" },
  { src: "/fresh-croissant-and-latte-on-marble-table.jpg", alt: "Pastry and coffee" },
  { src: "/pour-over-coffee-brewing-glass-carafe.jpg", alt: "Pour over brewing" },
  { src: "/happy-customers-enjoying-coffee-in-cafe.jpg", alt: "Customers enjoying coffee" },
]

export function Gallery() {
  return (
    <section id="gallery" className="py-24 md:py-32 bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">A Glimpse Inside</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground text-balance">Our Space</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-xl group ${
                index === 0 ? "md:row-span-2" : ""
              } ${index === 3 ? "md:col-span-2" : ""}`}
            >
              <img
                src={image.src || "/placeholder.svg"}
                alt={image.alt}
                className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
