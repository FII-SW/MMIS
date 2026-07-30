import Header from "./Header";
import PageHeaderWithBack from "./PageHeaderWithBack";

/** Page layout with back button for loading and interim states. */
export default function PageLoadingState({ title, onBack, message = "Loading..." }) {
  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />
      <PageHeaderWithBack title={title} onBack={onBack} />
      <p className="text-center mt-10 text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
