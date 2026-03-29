type Props = {
  children: React.ReactNode;
};

export default function GameCard({ children }: Props) {
  return (
    <div className="mt-12 w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-8">
      {children}
    </div>
  );
}
