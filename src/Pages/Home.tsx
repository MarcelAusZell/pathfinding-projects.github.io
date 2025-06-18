import Background from "../components/AppLayout/BackGround";

export default function HomePage() {
  return (
    <Background>
      <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl max-w-3xl flex flex-col items-center shadow-xl border border-gray-300/10 dark:border-gray-600/10 p-6 font-bold">
        <p className="text-xl text-center m-4">
          Welcome to graph algorithms visualizer
        </p>
        <p className="text-xl text-center m-4 font-bold">
          Explore various graph algorithms with interactive visualizations.
          More algorithms and features are coming soon!
        </p>
      </div>
    </Background>
  );
}