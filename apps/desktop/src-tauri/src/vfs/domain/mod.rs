//! Domain Layer - Core business entities and value objects
//!
//! This layer contains the core business logic and is independent of
//! external frameworks, databases, or UI concerns.

pub mod entities;
pub mod value_objects;
pub mod events;

pub use entities::*;
pub use value_objects::*;
pub use events::*;



