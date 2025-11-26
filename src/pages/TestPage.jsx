import Link from "next/link";

export default function TestPage() {
  console.log('TestPage is rendering!');
  
  return (
    <div style={{ padding: '40px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <h1 style={{ color: '#388E3C', marginBottom: '20px' }}>✅ Test Page Working!</h1>
        <p style={{ fontSize: '18px', color: '#333' }}>
          If you can see this message, the basic app rendering is working.
        </p>
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#e8f5e9',
          borderRadius: '4px',
          border: '1px solid #388E3C'
        }}>
          <p style={{ margin: 0, color: '#2e7d32' }}>
            <strong>Current time:</strong> {new Date().toLocaleTimeString()}
          </p>
        </div>
        
        <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
          <p><strong>Next steps:</strong></p>
          <ol>
            <li>If you see this page, React is rendering correctly</li>
            <li>The issue is likely in the Layout or Dashboard component</li>
            <li>Go back to Dashboard and check the debug log</li>
          </ol>
        </div>
        
        <Link 
          href="/dashboard" 
          style={{
            display: 'inline-block',
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#388E3C',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px'
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}