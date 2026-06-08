# Create Connection

A directed dependency connection is created between two point versions within the same org. Connections are immutable once created. The publish workflow enforces acyclicity via a recursive CTE graph walk before inserting.
