// Local aggregator used solely for modulepreload intent.
// Import specifiers resolve via the importmap to their esm.sh targets.
import "htm";
import "react-dom";
import "react-dom/client";

// Export a no-op default to make this a valid module for modulepreload.
export default {};
