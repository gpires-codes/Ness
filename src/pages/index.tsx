import { useTranslation } from "react-i18next";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <h1 className="text-2xl font-semibold">{t("home.title")}</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl border p-4 col-span-2">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Earum,
          facilis dolorum, provident debitis hic distinctio sequi, praesentium
          unde soluta temporibus suscipit a enim pariatur voluptas vel laborum
          architecto sapiente consequatur.
        </div>
        <div className="glass rounded-xl border p-4">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Earum,
          facilis dolorum, provident debitis hic distinctio sequi.
        </div>

        <div className="glass rounded-xl border p-4">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Earum,
          facilis dolorum, provident debitis hic.
        </div>
        <div className="glass rounded-xl border p-4 col-span-2">
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Earum,
          facilis dolorum, provident debitis hic distinctio sequi, praesentium
          unde soluta temporibus suscipit a enim pariatur voluptas vel laborum
          architecto sapiente consequatur.
        </div>
      </div>
    </main>
  );
}
