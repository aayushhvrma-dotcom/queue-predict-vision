import { motion } from "framer-motion";

type BlurTextProps = {
  text: string;
  className?: string;
  delay?: number;
};

/** Word-by-word blur-in entrance animation. */
export function BlurText({ text, className, delay = 0 }: BlurTextProps) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          initial={{ opacity: 0, filter: "blur(14px)", y: 18 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{
            duration: 0.9,
            delay: delay + index * 0.09,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
          {index < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
