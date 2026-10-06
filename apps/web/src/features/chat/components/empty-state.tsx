export const EXAMPLE_QUESTIONS = [
  'Comprei online e me arrependi. Posso devolver?',
  'Qual o prazo para reclamar de um defeito?',
  'Meu nome foi negativado sem aviso. Isso pode?',
  'O banco pode me obrigar a contratar um seguro junto com o empréstimo?',
];

export function EmptyState({ onPick }: { onPick(question: string): void }) {
  return (
    <section className="max-w-[60ch] pt-10 lg:pt-20">
      <h1 className="font-law font-semibold text-[2rem] leading-tight tracking-tight lg:text-[2.5rem]">
        Pergunte sobre seus direitos de consumidor.
      </h1>
      <p className="mt-4 text-muted text-lg">
        Cada resposta mostra o artigo da lei de onde saiu, para você conferir com os próprios olhos.
      </p>
      <ul className="mt-10 border-line border-t">
        {EXAMPLE_QUESTIONS.map((question) => (
          <li key={question} className="border-line border-b">
            <button
              type="button"
              onClick={() => onPick(question)}
              className="w-full py-3 text-left hover:text-seal"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
