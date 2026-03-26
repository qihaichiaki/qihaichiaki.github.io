import { hero } from "./components/hero.js";

document.querySelector("#app").innerHTML = hero();

const revealNodes = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.22 }
);

revealNodes.forEach((node) => observer.observe(node));

const setScrollShift = () => {
  const shift = Math.min(window.scrollY * 0.12, 40);
  document.documentElement.style.setProperty("--sky-shift", `${shift}px`);
};

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
