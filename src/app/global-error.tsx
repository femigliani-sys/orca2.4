'use client';

/** Erro global (substitui o layout raiz quando algo falha no cliente). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: '#fffbeb',
                display: 'grid',
                placeItems: 'center',
                fontSize: 24,
              }}
            >
              ⚠️
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#0f172a' }}>Algo deu errado</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>
              Ocorreu um erro inesperado. Seus dados estão seguros.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
