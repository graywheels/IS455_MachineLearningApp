export default function FlashMessage({ searchParams }) {
  const status = searchParams?.status;
  const message = searchParams?.message;
  if (!status || !message) return null;

  return (
    <div className={`flash ${status === "error" ? "error" : "success"}`}>
      {decodeURIComponent(message)}
    </div>
  );
}
