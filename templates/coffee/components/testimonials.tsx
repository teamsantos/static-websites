"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"

const testimonials = [
  {
    quote: "The best coffee I've ever had. Brewstone has completely changed my morning ritual.",
    author: "Sarah M.",
    role: "Regular since 2019",
  },
  {
    quote: "Not just great coffee — the atmosphere makes you want to stay for hours. It's my second home.",
    author: "James K.",
    role: "Local Writer",
  },
  {
    quote: "Their lavender honey latte is absolutely divine. I drive 30 minutes just for it.",
    author: "Elena R.",
    role: "Coffee Enthusiast",
  },
]

export function Testimonials() {
  const [current, setCurrent] = useState(0)

  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length)
  const prev = () => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length)

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <Quote className="h-12 w-12 text-accent/30 mx-auto mb-8" />

        <div className="relative min-h-[200px] flex items-center justify-center">
          <blockquote>
            <p className="font-serif text-2xl md:text-4xl text-foreground leading-relaxed mb-8 text-balance">
              &ldquo;{testimonials[current].quote}&rdquo;
            </p>
            <footer>
              <p className="font-semibold text-foreground">{testimonials[current].author}</p>
              <p className="text-sm text-muted-foreground">{testimonials[current].role}</p>
            </footer>
          </blockquote>
        </div>

        <div className="flex items-center justify-center gap-4 mt-10">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-transparent"
            onClick={prev}
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${index === current ? "bg-accent" : "bg-border"}`}
                onClick={() => setCurrent(index)}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-transparent"
            onClick={next}
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
