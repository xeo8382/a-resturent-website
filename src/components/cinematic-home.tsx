"use client";
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowDown,
  ArrowUpRight,
  Flame,
  Leaf,
  UtensilsCrossed,
} from "lucide-react";
import { Reveal } from "./reveal";
const dishes = [
  {
    name: "Fire-roasted chicken",
    slug: "fire-roasted-chicken",
    image: "chicken",
    note: "A little char. A whole lot of soul.",
    category: "01 / FROM THE FIRE",
    className: "chicken-photo",
  },
  {
    name: "The ember beef bowl",
    slug: "ember-beef-bowl",
    image: "steak",
    note: "Slow cooked. Worth slowing down for.",
    category: "02 / COMFORT, REIMAGINED",
    className: "steak-photo",
  },
  {
    name: "Garden harvest bowl",
    slug: "garden-harvest",
    image: "harvest",
    note: "Rooted in the season. Full of life.",
    category: "03 / FROM THE GARDEN",
    className: "harvest-photo",
  },
];
function WordReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="word-window">
      <motion.span
        initial={reduced ? false : { y: "110%" }}
        whileInView={{ y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: reduced ? 0 : 1.1,
          delay: reduced ? 0 : delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}
export function CinematicHome() {
  const hero = useRef<HTMLElement>(null);
  const story = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress: heroProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(heroProgress, [0, 1], [0, 120]);
  const heroScale = useTransform(heroProgress, [0, 1], [1, 1.12]);
  const textY = useTransform(heroProgress, [0, 1], [0, 65]);
  const insetY = useTransform(heroProgress, [0, 1], [0, -85]);
  const { scrollYProgress: storyProgress } = useScroll({
    target: story,
    offset: ["start end", "end start"],
  });
  const storyY = useTransform(storyProgress, [0, 1], [45, -45]);
  const storySmallY = useTransform(storyProgress, [0, 1], [-25, 35]);
  return (
    <main id="main">
      <section ref={hero} className="cinema-hero" aria-labelledby="hero-title">
        <motion.div
          className="cinema-backdrop"
          style={reduced ? undefined : { y: heroY, scale: heroScale }}
        >
          <Image
            src="/photos/kitchen.jpg"
            alt="Chefs finishing colourful plates together at an open restaurant kitchen"
            fill
            sizes="(max-width: 760px) 400vw, 120vw"
            priority
          />
        </motion.div>
        <div className="cinema-shade" />
        <motion.div
          className="cinema-copy"
          style={reduced ? undefined : { y: textY }}
        >
          <Reveal>
            <p className="eyebrow">
              <span className="copper-dot" /> FIRE. FLAVOUR. FEELING.
            </p>
          </Reveal>
          <h1 id="hero-title">
            <WordReveal delay={0.05}>Made by fire.</WordReveal>
            <WordReveal delay={0.2}>
              Shared with <em>love.</em>
            </WordReveal>
          </h1>
          <Reveal delay={0.3}>
            <p className="cinema-description">
              Honest ingredients. A little smoke. A lot of soul.
              <br />A meal to remember. A moment to stay for.
            </p>
            <div className="hero-ctas">
              <Link className="button" href="/menu">
                Explore the menu <ArrowUpRight size={17} />
              </Link>
              <a className="cinema-story-link" href="#story">
                The story behind the flame <ArrowUpRight size={13} />
              </a>
            </div>
          </Reveal>
        </motion.div>
        <motion.div
          className="hero-photo-layer"
          style={reduced ? undefined : { y: insetY }}
        >
          <div className="hero-photo-frame">
            <Image
              src="/photos/chicken.jpg"
              alt="A golden skillet of chicken and herbs, a serving inspiration"
              fill
              sizes="(max-width: 760px) 130px, 240px"
            />
          </div>
          <span className="hero-photo-caption">
            A little char.
            <br />
            <i>A lot of character.</i>
          </span>
          <span className="photo-corner" aria-hidden="true">
            01 —
          </span>
        </motion.div>
        <div className="cinema-hero-footer">
          <a className="scroll-invitation" href="#favourites">
            <span className="scroll-circle">
              <ArrowDown size={16} />
            </span>
            <span>SCROLL TO SAVOUR</span>
          </a>
          <p>
            GOOD FOOD.
            <br />
            BETTER COMPANY.
          </p>
          <span className="hero-edition">
            THE EMBER & TABLE JOURNAL
            <br />
            <span>VOL. 01 — A TASTE OF SOMETHING GOOD</span>
          </span>
        </div>
      </section>
      <section className="opening-note" aria-label="Our invitation">
        <Reveal>
          <p className="eyebrow">NOT JUST A PLACE TO EAT.</p>
          <h2>
            A reason to <em>linger.</em>
          </h2>
          <p>
            For the first bite. For the last conversation.
            <br />
            For the moments that taste a little like home.
          </p>
        </Reveal>
        <span className="note-mark" aria-hidden="true">
          e&t
        </span>
      </section>
      <section id="favourites" className="editorial-menu">
        <Reveal className="editorial-menu-heading">
          <p className="eyebrow">
            THE SIGNATURE COLLECTION <span>— 01 / 03</span>
          </p>
          <div>
            <h2>
              Some things just
              <br />
              hit <em>different.</em>
            </h2>
            <p>
              Thoughtfully made.
              <br />
              Impossible to forget.
            </p>
            <Link href="/menu" className="text-link">
              View the whole menu <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="editorial-dishes">
          {dishes.map((dish, i) => (
            <Reveal
              key={dish.slug}
              delay={i * 0.1}
              className={`editorial-dish-wrap editorial-dish-${i}`}
            >
              <Link href={`/menu/${dish.slug}`} className="editorial-dish">
                <div className={`editorial-dish-image ${dish.className}`}>
                  <Image
                    src={`/photos/${dish.image}.jpg`}
                    alt={`Serving inspiration for ${dish.name}`}
                    fill
                    sizes="(max-width:760px) 88vw, 32vw"
                  />
                  <span className="editorial-dish-tag">{dish.category}</span>
                  <span className="editorial-dish-action">
                    <ArrowUpRight size={24} />
                  </span>
                </div>
                <div className="editorial-dish-title">
                  <h3>{dish.name}</h3>
                  <ArrowUpRight size={13} />
                </div>
                <p>{dish.note}</p>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="collection-footnote">
          <span>FIRE-LED COOKING. SEASON-LED THINKING.</span>
          <p>Concept menu · Photography shows serving inspiration.</p>
        </div>
      </section>
      <section className="story-chapter" id="story" ref={story}>
        <div className="chapter-side">
          <span className="chapter-number">02</span>
          <span>BEHIND THE FLAME</span>
        </div>
        <div className="story-photo-composition">
          <motion.div
            className="story-photo-main"
            style={reduced ? undefined : { y: storyY }}
          >
            <Image
              src="/photos/kitchen.jpg"
              alt="Hands at work plating a meal in an open kitchen"
              fill
              sizes="(max-width:760px) 85vw, 45vw"
            />
          </motion.div>
          <motion.div
            className="story-photo-detail"
            style={reduced ? undefined : { y: storySmallY }}
          >
            <Image
              src="/photos/vegetables.jpg"
              alt="A colourful table of fresh vegetables, bread and warm cheese"
              fill
              sizes="(max-width:760px) 40vw, 22vw"
            />
          </motion.div>
          <span className="story-photo-label">
            GOOD THINGS TAKE A LITTLE TIME.
          </span>
        </div>
        <Reveal className="chapter-copy">
          <p className="eyebrow">ROOTED IN SOMETHING REAL</p>
          <h2>
            A spark.
            <br />A table.
            <br />
            <em>A connection.</em>
          </h2>
          <p>
            The best moments rarely ask for much. A warm plate. Something passed
            around. Someone saying, “you have to try this.”
          </p>
          <p>
            That’s the feeling behind Ember & Table. Cooking with intention.
            Sharing without ceremony. Making room for one more.
          </p>
          <Link href="/menu" className="text-link">
            Find your next favourite <ArrowUpRight size={17} />
          </Link>
        </Reveal>
      </section>
      <section className="philosophy">
        <Reveal>
          <Flame />
          <span>01</span>
          <h3>Led by the flame.</h3>
          <p>
            Slow heat. Bold flavour.
            <br />A little char goes a long way.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <Leaf />
          <span>02</span>
          <h3>Rooted in the good.</h3>
          <p>
            Thoughtful ingredients.
            <br />
            Nothing here by accident.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <UtensilsCrossed />
          <span>03</span>
          <h3>Better together.</h3>
          <p>
            Generous plates.
            <br />
            Always room for one more.
          </p>
        </Reveal>
      </section>
      <section id="visit" className="last-course">
        <div className="last-course-photo">
          <Image
            src="/photos/harvest.jpg"
            alt="A warm bowl of chickpea curry, rice and fresh herbs"
            fill
            sizes="(max-width:760px) 100vw, 50vw"
          />
        </div>
        <Reveal className="last-course-copy">
          <p className="eyebrow">SAVE A LITTLE ROOM</p>
          <h2>
            Your next good
            <br />
            memory starts
            <br />
            <em>at the table.</em>
          </h2>
          <p>A little comfort, wherever your table is.</p>
          <Link href="/menu" className="button">
            Let’s eat <ArrowUpRight size={18} />
          </Link>
          <p className="sample-note">
            Concept restaurant. Location & hours to be announced.
            <br />
            Sample orders for delivery or pickup.
          </p>
        </Reveal>
        <span className="last-course-watermark" aria-hidden="true">
          stay awhile.
        </span>
      </section>
    </main>
  );
}
