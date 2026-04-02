export default async function FlashMessage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status;
  const message = params?.message;
  if (!status || !message) return null;

  return (
    <div className={`flash ${status === "error" ? "error" : "success"}`}>
      {decodeURIComponent(message)}
    </div>
  );
}
