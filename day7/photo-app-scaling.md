# SnapShare Photo App Scaling Plan

## 1. Assumptions and Estimates

SnapShare has 10 million registered users. I assume 10% of registered users are active daily, each daily active user uploads one photo and views 50 feed pages per day. Each original photo is 2 MB and each thumbnail is 50 KB. I use 86,400 seconds per day and 365 days per year. Peak feed traffic is estimated at five times the average rate. These estimates exclude retries, deleted photos, video uploads, backups, replication overhead and future user growth.

### Daily Active Users

10,000,000 registered users × 10% active daily = **1,000,000 daily active users (DAU)**.

### Uploads per Second

- Daily uploads: 1,000,000 users × 1 photo = **1,000,000 photos per day**.
- Average uploads per second: 1,000,000 ÷ 86,400 = **11.57 uploads per second**, or approximately 12.
- This is an average; actual upload traffic may be higher during busy periods.

### Feed Views per Second

- Daily feed views: 1,000,000 users × 50 pages = **50,000,000 feed views per day**.
- Average feed views per second: 50,000,000 ÷ 86,400 = **578.7**, or approximately 579.
- Estimated peak feed views per second: 578.7 × 5 = **2,893.5**, or approximately 2,894.

### Photo Storage per Year

- Original photos per year: 1,000,000 × 365 = **365,000,000 photos**.
- Original photo storage: 365,000,000 × 2 MB = **730,000,000 MB**, approximately **730 TB per year** using decimal units.
- Thumbnail storage: 365,000,000 × 50 KB = **18,250,000,000 KB**, approximately **18.25 TB per year**.
- Total new photo and thumbnail storage: approximately **748.25 TB per year**, before replication, backups and metadata.

## 2. Read-Heavy or Write-Heavy?

SnapShare is **read-heavy** because users view 50 feed pages per day but upload only one photo per day. Feed views total approximately 50 million daily, compared with one million daily uploads. The design should prioritise fast feed delivery using a CDN, caching, and database read replicas, while queues and background workers handle thumbnail generation without slowing down uploads.

## 3. Where Photos Should Be Stored

Photos should be stored in object storage rather than directly inside the relational database. Photo files are large, and storing them in the database would increase database size, backup times and query overhead. Object storage is designed for durable, scalable file storage, while the database stores metadata such as photo ID, owner, caption, timestamp and object-storage key. The CDN can cache and deliver photo files closer to users.

## 4. Architecture Diagram

```text
                         +----------------------+
                         |        Users         |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |         CDN          |
                         | Cached photos/thumbnails
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |    Load Balancer     |
                         +----------+-----------+
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
              +-----------+   +-----------+   +-----------+
              | App Server|   | App Server|   | App Server|
              +-----+-----+   +-----+-----+   +-----+-----+
                    |               |               |
                    +---------------+---------------+
                                    |
                     +--------------+--------------+
                     |                             |
                     v                             v
              +-------------+              +---------------+
              | Cache       |              | Primary DB    |
              | Feed/data   |              +-------+-------+
              +-------------+                      |
                                                    v
                                            +---------------+
                                            | Read Replica  |
                                            +---------------+

 App Servers ---- photo metadata ----> Primary DB
 App Servers ---- upload job --------> Queue
                                          |
                                          v
                                    +-------------+
                                    | Thumbnail   |
                                    | Worker      |
                                    +------+------+
                                           |
                              reads original photo
                                           |
                                           v
                                    +-------------+
                                    | Object      |
                                    | Storage     |
                                    | Originals + |
                                    | Thumbnails  |
                                    +------+------+
                                           |
                                           v
                                          CDN
```

## 5. What Each Component Solves

- **CDN:** Caches and delivers photos and thumbnails close to users, reducing latency and origin-server traffic.
- **Load balancer:** Distributes incoming requests across app servers so that one server does not become overloaded.
- **App servers:** Handle authentication, photo uploads, feed requests, metadata operations and application logic.
- **Cache:** Stores frequently accessed feed data and metadata to reduce repeated database queries and speed up feed loading.
- **Primary database:** Stores authoritative data such as users, follows, photo metadata and upload records.
- **Read replica:** Handles suitable read queries so that feed traffic places less load on the primary database.
- **Object storage:** Stores original photo files and thumbnails durably and scales independently of the database.
- **Queue:** Holds thumbnail-generation jobs so uploads can finish without waiting for image processing.
- **Thumbnail worker:** Processes queued jobs, creates smaller image versions and saves them to object storage.

## 6. Photo Upload Flow

1. A user selects a photo and submits it through the app.
2. The app server authenticates the user and validates the file type, size and upload permissions.
3. The original photo is uploaded to object storage, ideally using a short-lived pre-signed upload URL so large files do not have to pass through the app server.
4. The app server saves the photo metadata and object-storage key in the primary database.
5. The app server places a thumbnail-generation job on the queue.
6. The app confirms the upload to the user without waiting for thumbnail processing to finish.
7. A thumbnail worker takes the job from the queue and reads the original photo from object storage.
8. The worker creates a 50 KB thumbnail and saves it to object storage.
9. The thumbnail becomes available through the CDN, and the feed can display it when requested.
10. If thumbnail processing fails, the job can be retried; monitoring and a dead-letter queue can help handle repeated failures.

## 7. Trade-Offs

### Faster reads versus consistency

Using a cache and read replica improves feed performance and reduces pressure on the primary database. However, cached data and replicas may be slightly out of date, so a newly uploaded photo or updated caption might not appear immediately everywhere.

### Asynchronous thumbnails versus immediate availability

A queue lets uploads finish quickly and protects app servers from expensive image-processing work. However, the original photo may be available before its thumbnail, so the app must handle a short delay and retry failed jobs.

### Object storage and CDN versus cost and complexity

Object storage and a CDN scale well for large photo libraries and global delivery. However, they introduce storage, bandwidth and cache-management costs, as well as more components to monitor.

### Read replicas versus operational complexity

Read replicas increase read capacity, but they add infrastructure and replication lag that the application must account for. Writes should go to the primary database, while suitable reads can be routed to replicas.


## Component Breakdown (Continued)

### 1. Client Application
The client allows users to upload photos and browse the feed. It sends upload requests to the application server and displays upload status to the user. Once a photo is ready, the client loads the thumbnail for feed views and the original image when needed.

### 2. Load Balancer
The load balancer distributes incoming requests across multiple application server instances. This prevents one server from becoming a bottleneck and allows the system to scale horizontally as traffic grows.

### 3. Application Servers
Application servers handle authentication, upload authorization, metadata requests, and feed retrieval. They validate upload details and coordinate with object storage and the message queue. They do not perform expensive thumbnail processing during the user's request.

### 4. Relational Database
The relational database stores structured metadata, including photo IDs, user IDs, captions, timestamps, object-storage keys, and processing status. It supports relationships and queries efficiently without storing large binary photo files directly in database tables.

### 5. Object Storage
Object storage holds the original uploaded photos and generated thumbnails. It is designed for durable storage of large files and allows media to scale independently of the relational database. Images are retrieved using their storage keys or authorized delivery URLs.

### 6. Cache
The cache stores frequently accessed feed data and photo metadata. Since many users repeatedly view popular content, caching reduces database queries and improves response times. Cache entries must be invalidated or updated when relevant metadata changes.

### 7. Read Replicas
Read replicas serve eligible read queries from copies of the primary database. They reduce the primary database's workload in this read-heavy application. Replication may introduce a short delay before recent updates appear on a replica.

### 8. Message Queue
The message queue holds thumbnail-generation jobs until workers can process them. The application server can acknowledge a successful upload without waiting for image resizing to finish. The queue also absorbs traffic spikes and allows processing capacity to scale independently.

### 9. Thumbnail Workers
Thumbnail workers consume queued jobs, retrieve original images from object storage, resize and compress them into thumbnail formats, and save the results back to object storage. Workers update the photo's processing status and retry recoverable failures.

### 10. CDN (Content Delivery Network)
A CDN caches image files at edge locations closer to users. This reduces latency and the amount of traffic reaching the origin storage, particularly when popular photos are viewed by many users.

## End-to-End Photo Upload Lifecycle

1. **User initiates an upload:** The client requests permission to upload a photo. The application server authenticates the user, validates the request, and authorizes the upload.

2. **Upload destination is prepared:** The server creates a unique photo ID and an authorized upload destination, such as a pre-signed object-storage URL. This allows the client to upload the binary file directly to object storage without routing the entire file through the application server.

3. **Original photo is uploaded:** The client sends the image to object storage. Storage validation checks that the upload completed successfully and that the file meets size and format requirements. Additional security checks, including malware scanning where appropriate, may be applied before publication.

4. **Metadata is recorded:** The application records the photo ID, owner, caption, original object key, timestamp, and processing status in the relational database. The photo is marked as `PROCESSING` until the thumbnail is ready.

5. **A thumbnail job is queued:** The application publishes a job containing the photo ID, original object key, and required thumbnail specifications to the message queue. The job should be published reliably, using a transactional outbox or an equivalent mechanism to avoid losing work if the database update succeeds but queue publication fails.

6. **The upload response returns:** Once the original upload and required metadata and job records are safely established, the API returns an upload-success response to the client. The client can show that the photo has been received and that processing is underway. It does not need to wait for image resizing to finish.

7. **A worker processes the job:** A thumbnail worker retrieves the job from the queue, reads the original image from object storage, validates and decodes it, and generates appropriately sized and compressed thumbnails.

8. **The thumbnail is stored:** The worker writes the generated thumbnail to object storage using a predictable or versioned object key. The original remains available separately at its original key.

9. **Processing status is updated:** After thumbnail storage succeeds, the worker updates the photo metadata to `READY`. The feed can now display the thumbnail. If processing fails, the job can be retried with backoff; repeated failures are sent to a dead-letter queue for investigation.

10. **The photo is delivered to viewers:** When another user opens the feed, the application retrieves photo metadata from the cache or database, and the thumbnail is served from the CDN or object storage. The original image is fetched separately when a full-resolution view is requested.

### Why the Queue and Workers Matter

Thumbnail generation can consume CPU and memory, especially during peak upload periods. Processing every image synchronously would increase upload latency and could exhaust application-server resources.

The queue separates accepting an upload from processing the image. Workers consume jobs at a manageable rate and can be scaled horizontally when the backlog grows. This improves responsiveness and resilience, although users may briefly see a processing indicator while a thumbnail is generated.

## Architectural Trade-Off Evaluation

### Trade-Off 1: Eventual Consistency vs. Immediate Consistency

**Decision:** Use asynchronous thumbnail processing and read replicas where appropriate.

**Benefits:**
- Users receive upload acknowledgements without waiting for thumbnail generation.
- Read replicas reduce pressure on the primary database.
- The queue absorbs bursts of work instead of overwhelming application servers.

**Costs:**
- A newly uploaded photo may not immediately appear as ready in every feed.
- Read replicas may briefly return stale metadata.
- Failed or delayed jobs can leave a photo in the `PROCESSING` state longer than expected.

**Mitigation:** Track processing status explicitly, retry transient failures, monitor queue age, and allow clients to refresh or poll for readiness. Use the primary database for operations requiring read-after-write consistency, and make workers idempotent so retrying a job does not create inconsistent results.

### Trade-Off 2: Operational Simplicity vs. Independent Scalability

**Decision:** Separate object storage, relational metadata, a message queue, thumbnail workers, caching, and CDN delivery rather than building everything into one application server.

**Benefits:**
- Each component can scale according to its own workload.
- Binary media does not inflate database tables or backups.
- Workers can process images independently of user-facing requests.
- CDN caching reduces origin traffic and improves global delivery performance.

**Costs:**
- More infrastructure requires additional monitoring, deployment, security configuration, and operational expertise.
- Failures can occur between components, requiring retries, alerts, and recovery procedures.
- Storage and metadata must remain coordinated to avoid orphaned files or missing thumbnails.

**Mitigation:** Automate deployment, monitor service health and queue backlogs, use structured logs and alerts, implement idempotent jobs, and periodically clean up orphaned objects. Start with managed cloud services where practical to reduce operational overhead.

## Conclusion

SnapShare is designed as a read-heavy photo-sharing platform with a clear separation between metadata, binary media storage, and asynchronous processing. The relational database manages structured information, object storage holds originals and thumbnails, caching and read replicas support high-volume reads, and the CDN reduces media-delivery latency.

The message queue and thumbnail workers keep expensive image processing out of the synchronous upload path. The architecture deliberately accepts limited eventual consistency and additional operational complexity in exchange for better responsiveness, resilience, and independent scalability. Monitoring, retry policies, secure uploads, and reliable job publication are essential to making this design production-ready.