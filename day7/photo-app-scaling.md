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

## Conclusion

SnapShare should use a read-optimised architecture with a CDN, cache and read replica, while storing photo files in object storage and generating thumbnails asynchronously through a queue and worker. Based on the stated assumptions, it serves about 579 feed views per second on average, with an estimated peak of 2,894, and adds about 748.25 TB of photo and thumbnail data each year before overheads. The architecture can scale individual components as traffic and storage grow.